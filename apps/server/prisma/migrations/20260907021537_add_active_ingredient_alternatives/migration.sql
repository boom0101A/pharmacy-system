-- AlterTable
ALTER TABLE "products" ADD COLUMN     "active_ingredient" TEXT,
ADD COLUMN     "dosage_form" TEXT,
ADD COLUMN     "strength" TEXT;

-- CreateIndex
CREATE INDEX "products_active_ingredient_idx" ON "products"("active_ingredient");
