-- El logro «hist_corralito» se llamaba «Corralito de Villamontes», pero el «Corralito» fue el golpe de noviembre de 1934
-- contra el presidente Salamanca, no la defensa de la ciudad (febrero de 1935). Pasa a llamarse «hist_villamontes».

-- Quien ya lo tenía lo conserva con el id nuevo (si ya tuviera ambos, solo se borra el antiguo).
UPDATE "AchievementUnlock" AS a
SET "achievementId" = 'hist_villamontes'
WHERE a."achievementId" = 'hist_corralito'
  AND NOT EXISTS (
    SELECT 1 FROM "AchievementUnlock" AS b
    WHERE b."userId" = a."userId" AND b."achievementId" = 'hist_villamontes'
  );

DELETE FROM "AchievementUnlock" WHERE "achievementId" = 'hist_corralito';
