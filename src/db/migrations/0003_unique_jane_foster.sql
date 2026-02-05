CREATE TABLE "reservation_daily_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_room_id" integer NOT NULL,
	"date" date NOT NULL,
	"rate" numeric(10, 2) NOT NULL,
	"rate_plan_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "reservation_daily_rates" ADD CONSTRAINT "reservation_daily_rates_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_daily_rates" ADD CONSTRAINT "reservation_daily_rates_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_rates_room_date_unique" ON "reservation_daily_rates" USING btree ("reservation_room_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_rates_room" ON "reservation_daily_rates" USING btree ("reservation_room_id");--> statement-breakpoint
CREATE INDEX "idx_daily_rates_date" ON "reservation_daily_rates" USING btree ("date");--> statement-breakpoint
ALTER TABLE "reservation_rooms" DROP COLUMN "rate";