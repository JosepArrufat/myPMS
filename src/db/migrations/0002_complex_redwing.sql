DROP INDEX "idx_housekeeping_current";--> statement-breakpoint
DROP INDEX "idx_maintenance_current";--> statement-breakpoint
CREATE INDEX "idx_housekeeping_current" ON "housekeeping_tasks" USING btree ("task_date","status","room_id");--> statement-breakpoint
CREATE INDEX "idx_maintenance_current" ON "maintenance_requests" USING btree ("scheduled_date","status","room_id");