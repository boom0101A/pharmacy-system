-- CreateTable
CREATE TABLE "batch_write_offs" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_write_offs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "batch_write_offs" ADD CONSTRAINT "batch_write_offs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_write_offs" ADD CONSTRAINT "batch_write_offs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
