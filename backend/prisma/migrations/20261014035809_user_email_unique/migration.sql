-- One email per Privy user (see schema.prisma, model User).
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
