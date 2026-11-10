import { ACHIEVEMENTS, RENAMED, earned, getAchievement, quizEarned } from '../domain/achievements.js';
import { gradeQuiz, quizMissions } from '../domain/quiz.js';
import { rankFor } from '../domain/ranks.js';
import { laminasFor } from '../domain/laminas.js';
import { CAMPAIGNS, evaluateMission, getMission } from '../domain/campaigns.js';

const key = (row) => `${row.campaignId}:${row.missionId}`;
const publicAchievement = ({ id, category, icon, name, text }) => ({ id, category, icon, name, text });
export const starsMap = (rows) => new Map(rows.map((r) => [key(r), r.stars]));

/**
 * Progreso de campañas y logros de una cuenta. No conoce la red ni las salas: recibe el resumen de una partida
 * ya terminada y guarda lo que corresponda en el almacén.
 */
export function createProgress({ store, log = () => {} }) {
  return {
    /** Progreso completo de una cuenta (campañas, estrellas, logros). */
    async overview(userId) {
      const [rows, unlocks, quiz] = await Promise.all([store.getCampaignProgress(userId), store.getUnlocks(userId), store.getQuizResults(userId)]);
      const totalStars = rows.reduce((a, r) => a + r.stars, 0);
      // Un logro con id antiguo (renombrado) se muestra con su id actual; los desconocidos y los repetidos se descartan.
      const seen = new Set();
      const achievements = [];
      for (const u of unlocks) {
        const id = RENAMED[u.achievementId] ?? u.achievementId;
        if (!getAchievement(id) || seen.has(id)) continue;
        seen.add(id);
        achievements.push({ id, date: u.unlockedAt });
      }
      return {
        missions: rows.map((r) => ({ campaignId: r.campaignId, missionId: r.missionId, stars: r.stars, bestShots: r.bestShots, date: r.updatedAt })),
        achievements,
        laminas: laminasFor(starsMap(rows)),
        quiz: quiz.map((q) => ({ campaignId: q.campaignId, missionId: q.missionId, best: q.bestCorrect, total: q.total, attempts: q.attempts })),
        rank: rankFor(totalStars),
        totalStars,
        totalAchievements: ACHIEVEMENTS.length,
      };
    },

    /**
     * Corrige un cuestionario. Con cuenta, guarda el mejor resultado y puede desbloquear logros de estudio;
     * como invitado solo devuelve la corrección. Lanza `QuizError` si las respuestas no corresponden.
     */
    async answerQuiz({ userId = null, campaignId, missionId, answers }) {
      const graded = gradeQuiz(campaignId, missionId, answers);
      if (!userId) return { ...graded, saved: false, newAchievements: [] };
      const saved = await store.saveQuizResult(userId, { campaignId, missionId: Number(missionId), correct: graded.correct, total: graded.total });
      const results = await store.getQuizResults(userId);
      const fresh = await store.unlockAchievements(userId, quizEarned(results, quizMissions(CAMPAIGNS)));
      return { ...graded, saved: true, best: saved.bestCorrect, attempts: saved.attempts, newAchievements: fresh.map(getAchievement).filter(Boolean).map(publicAchievement) };
    },

    /** Estrellas por "campaña:misión", para decidir qué misiones están desbloqueadas. */
    async starsOf(userId) {
      return starsMap(await store.getCampaignProgress(userId));
    },

    /**
     * Se llama una vez por persona con cuenta al terminar una partida (después de guardar la partida).
     * @returns {Promise<{mission:null|{saved:boolean,improved:boolean,previousStars:number,bestShots:number}, newAchievements:object[]}>}
     */
    async afterMatch({ userId, summary, match, missionRef }) {
      let mission = null;
      if (missionRef) {
        const def = getMission(missionRef.campaignId, missionRef.missionId);
        const ev = def ? evaluateMission(def, summary) : null;
        if (ev?.won) {
          const saved = await store.saveMissionResult(userId, { campaignId: missionRef.campaignId, missionId: missionRef.missionId, stars: ev.stars, shots: summary.shots });
          mission = { stars: ev.stars, ...saved };
        } else if (ev) {
          mission = { stars: 0, improved: false, previousStars: 0, bestShots: null };
        }
      }
      const [rows, facts] = await Promise.all([store.getCampaignProgress(userId), store.achievementFacts(userId)]);
      const ids = earned({ summary, match, mission, stars: starsMap(rows), facts });
      const fresh = await store.unlockAchievements(userId, ids);
      const newAchievements = fresh.map(getAchievement).filter(Boolean).map(({ id, category, icon, name, text }) => ({ id, category, icon, name, text }));
      if (newAchievements.length) log(`logros de ${userId}: ${newAchievements.map((a) => a.id).join(', ')}`);
      return { mission, newAchievements };
    },
  };
}
