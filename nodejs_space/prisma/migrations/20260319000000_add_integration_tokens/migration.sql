-- CreateTable
CREATE TABLE "integration_tokens" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_tokens_provider_key" ON "integration_tokens"("provider");
