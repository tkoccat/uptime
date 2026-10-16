-- Alan adı bitişi okunamayan monitörler yeni yöntemle (IANA RDAP) hemen yeniden denensin
UPDATE "Monitor" SET "expiryCheckedAt" = NULL WHERE "domainExpiresAt" IS NULL;