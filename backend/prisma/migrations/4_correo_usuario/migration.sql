-- Agrega correo electrónico único (en minúsculas) a las cuentas de usuario.
-- Es anulable (NULL) en la tabla para que las cuentas creadas antes de esta migración no se rompan.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

