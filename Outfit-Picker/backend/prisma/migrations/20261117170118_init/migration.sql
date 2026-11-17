-- CreateEnum
CREATE TYPE "ClothingCategory" AS ENUM ('TOP', 'BOTTOM');

-- CreateEnum
CREATE TYPE "ClothingType" AS ENUM ('T_SHIRT', 'LONG_SLEEVE', 'HOODIE', 'SWEATSHIRT', 'SWEATER', 'POLO', 'TANK_TOP', 'OTHER_TOP', 'JEANS', 'CHINOS', 'DRESS_PANTS', 'SHORTS', 'SWEATPANTS', 'JOGGERS', 'CARGO_PANTS', 'OTHER_BOTTOM');

-- CreateEnum
CREATE TYPE "ColorName" AS ENUM ('BLACK', 'WHITE', 'GRAY', 'NAVY', 'BLUE', 'RED', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BROWN', 'BEIGE', 'CREAM', 'OTHER');

-- CreateEnum
CREATE TYPE "OutfitItemRole" AS ENUM ('TOP', 'BOTTOM');

-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ClothingCategory" NOT NULL,
    "type" "ClothingType" NOT NULL,
    "color" "ColorName" NOT NULL,
    "brand" TEXT,
    "size" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,
    "role" "OutfitItemRole" NOT NULL,

    CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredImage" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastResetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClothingItem_category_idx" ON "ClothingItem"("category");

-- CreateIndex
CREATE INDEX "ClothingItem_type_idx" ON "ClothingItem"("type");

-- CreateIndex
CREATE INDEX "ClothingItem_color_idx" ON "ClothingItem"("color");

-- CreateIndex
CREATE INDEX "ClothingItem_brand_idx" ON "ClothingItem"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "OutfitItem_outfitId_clothingItemId_role_key" ON "OutfitItem"("outfitId", "clothingItemId", "role");

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
