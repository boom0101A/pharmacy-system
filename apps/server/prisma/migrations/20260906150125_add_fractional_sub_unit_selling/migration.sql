-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "opened_sub_units" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sub_unit_name" TEXT,
ADD COLUMN     "sub_unit_price" DECIMAL(12,2),
ADD COLUMN     "units_per_package" INTEGER;

-- AlterTable
ALTER TABLE "return_items" ADD COLUMN     "is_sub_unit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "is_sub_unit" BOOLEAN NOT NULL DEFAULT false;
