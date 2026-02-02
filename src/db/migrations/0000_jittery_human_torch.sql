CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'front_desk', 'housekeeping', 'accountant', 'sales', 'guest_services');--> statement-breakpoint
CREATE TYPE "public"."guest_document_type" AS ENUM('passport', 'national_id', 'drivers_license', 'residence_permit', 'other');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('available', 'occupied', 'maintenance', 'out_of_order', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."rate_adjustment_type" AS ENUM('amount', 'percent');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."room_block_type" AS ENUM('maintenance', 'renovation', 'group_hold', 'overbooking_buffer', 'vip_hold');--> statement-breakpoint
CREATE TYPE "public"."invoice_item_type" AS ENUM('room', 'food', 'beverage', 'minibar', 'laundry', 'spa', 'parking', 'telephone', 'internet', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('final', 'deposit', 'adjustment', 'cancellation');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'credit_card', 'debit_card', 'bank_transfer', 'cheque', 'online_payment', 'corporate_account');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_status" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'inspected');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_type" AS ENUM('client_service', 'checkout_cleaning', 'maintenance_prep', 'carpet_cleaning', 'deep_cleaning', 'vip_setup', 'turndown_service', 'linen_change', 'inspection', 'special_request');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('insert', 'update', 'delete');--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" "user_role" NOT NULL,
	"permission_id" serial NOT NULL,
	CONSTRAINT "role_permissions_role_permission_id_pk" PRIMARY KEY("role","permission_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(50),
	"role" "user_role" DEFAULT 'front_desk' NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" serial NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"date_of_birth" date,
	"nationality" varchar(100),
	"language_preference" varchar(10) DEFAULT 'en',
	"id_document_type" "guest_document_type",
	"id_document_number" varchar(100),
	"id_document_expiry" date,
	"id_document_country" varchar(100),
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"state_province" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100),
	"preferences" jsonb,
	"dietary_restrictions" text,
	"special_needs" text,
	"observations" text,
	"marketing_opt_in" boolean DEFAULT false,
	"vip_status" boolean DEFAULT false,
	"loyalty_number" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" serial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"max_occupancy" integer DEFAULT 2 NOT NULL,
	"max_adults" integer DEFAULT 2 NOT NULL,
	"max_children" integer DEFAULT 1 NOT NULL,
	"size_sqm" numeric(6, 2),
	"bed_configuration" varchar(100),
	"view_type" varchar(50),
	"amenities" jsonb,
	"images" jsonb,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "room_types_name_unique" UNIQUE("name"),
	CONSTRAINT "room_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_number" varchar(20) NOT NULL,
	"room_type_id" integer NOT NULL,
	"floor" integer,
	"building" varchar(50),
	"status" "room_status" DEFAULT 'available' NOT NULL,
	"has_connecting_door" boolean DEFAULT false,
	"connecting_room_id" integer,
	"is_accessible" boolean DEFAULT false,
	"last_deep_clean" date,
	"last_maintenance" date,
	"next_maintenance_due" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rooms_room_number_unique" UNIQUE("room_number")
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT true,
	"requires_advance_booking_days" integer DEFAULT 0,
	"min_length_of_stay" integer DEFAULT 1,
	"max_length_of_stay" integer,
	"cancellation_policy" text,
	"cancellation_deadline_hours" integer,
	"cancellation_fee_percent" numeric(5, 2),
	"includes_breakfast" boolean DEFAULT false,
	"includes_lunch" boolean DEFAULT false,
	"includes_dinner" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rate_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "room_type_rate_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_room_type_id" integer NOT NULL,
	"derived_room_type_id" integer NOT NULL,
	"rate_plan_id" integer,
	"adjustment_type" "rate_adjustment_type" DEFAULT 'amount' NOT NULL,
	"adjustment_value" numeric(10, 2) NOT NULL,
	"allow_override" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_type_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_type_id" integer NOT NULL,
	"rate_plan_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"min_stay" integer DEFAULT 1,
	"applies_monday" boolean DEFAULT true,
	"applies_tuesday" boolean DEFAULT true,
	"applies_wednesday" boolean DEFAULT true,
	"applies_thursday" boolean DEFAULT true,
	"applies_friday" boolean DEFAULT true,
	"applies_saturday" boolean DEFAULT true,
	"applies_sunday" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(20),
	"type" varchar(50),
	"contact_person" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"address_line1" varchar(255),
	"city" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100),
	"vat_number" varchar(50),
	"commission_percent" numeric(4, 2),
	"payment_terms_days" integer DEFAULT 30,
	"api_key" text,
	"channel_manager_id" varchar(100),
	"is_travel_agency" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "reservation_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_id" uuid NOT NULL,
	"room_id" integer,
	"room_type_id" integer NOT NULL,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"rate" numeric(10, 2) NOT NULL,
	"rate_plan_id" integer,
	"assigned_at" timestamp,
	"assigned_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_number" varchar(50) NOT NULL,
	"guest_id" uuid NOT NULL,
	"guest_name_snapshot" varchar(255) NOT NULL,
	"guest_email_snapshot" varchar(255),
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"actual_check_in_time" timestamp,
	"actual_check_out_time" timestamp,
	"adults_count" integer DEFAULT 1 NOT NULL,
	"children_count" integer DEFAULT 0 NOT NULL,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"source" varchar(50),
	"agency_id" integer,
	"rate_plan_id" integer,
	"special_requests" text,
	"arrival_time" varchar(10),
	"observations" text,
	"total_amount" numeric(10, 2),
	"deposit_amount" numeric(10, 2),
	"deposit_paid_at" timestamp,
	"currency" varchar(3) DEFAULT 'USD',
	"cancelled_at" timestamp,
	"cancelled_by" integer,
	"cancellation_reason" text,
	"cancellation_fee" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "reservations_reservation_number_unique" UNIQUE("reservation_number")
);
--> statement-breakpoint
CREATE TABLE "room_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_id" uuid NOT NULL,
	"room_id" integer NOT NULL,
	"date" date NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "room_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer,
	"room_type_id" integer,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"block_type" "room_block_type" NOT NULL,
	"quantity" integer DEFAULT 1,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	"released_at" timestamp,
	"released_by" integer
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"item_type" "invoice_item_type" NOT NULL,
	"description" text NOT NULL,
	"date_of_service" date,
	"quantity" numeric(10, 3) DEFAULT '1' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"room_id" integer,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"invoice_type" "invoice_type" DEFAULT 'final' NOT NULL,
	"reservation_id" uuid,
	"guest_id" uuid NOT NULL,
	"issue_date" date DEFAULT now() NOT NULL,
	"due_date" date,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"tax_rate" numeric(5, 4),
	"tax_number" varchar(50),
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"transaction_reference" varchar(255),
	"card_type" varchar(50),
	"authorization_code" varchar(50),
	"currency" varchar(3) DEFAULT 'USD',
	"exchange_rate" numeric(10, 6) DEFAULT '1',
	"is_refund" boolean DEFAULT false,
	"refunded_payment_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "housekeeping_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"task_date" date DEFAULT now() NOT NULL,
	"task_type" "housekeeping_task_type" NOT NULL,
	"priority" integer DEFAULT 0,
	"status" "housekeeping_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"inspected_at" timestamp,
	"inspected_by" integer,
	"notes" text,
	"found_items" text,
	"maintenance_needed" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer,
	"category" varchar(50),
	"priority" "maintenance_priority" DEFAULT 'normal',
	"description" text NOT NULL,
	"status" "maintenance_status" DEFAULT 'open' NOT NULL,
	"assigned_to" integer,
	"scheduled_date" date,
	"started_at" timestamp,
	"completed_at" timestamp,
	"resolution_notes" text,
	"parts_used" text,
	"cost" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_rate_revenue" (
	"date" date NOT NULL,
	"rate_plan_id" integer NOT NULL,
	"rooms_sold" integer DEFAULT 0,
	"room_revenue" numeric(10, 2) DEFAULT '0',
	"average_rate" numeric(10, 2) DEFAULT '0',
	"calculated_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_rate_revenue_date_rate_plan_id_pk" PRIMARY KEY("date","rate_plan_id")
);
--> statement-breakpoint
CREATE TABLE "daily_revenue" (
	"date" date PRIMARY KEY NOT NULL,
	"total_reservations" integer DEFAULT 0,
	"checked_in" integer DEFAULT 0,
	"checked_out" integer DEFAULT 0,
	"no_shows" integer DEFAULT 0,
	"cancellations" integer DEFAULT 0,
	"room_revenue" numeric(12, 2) DEFAULT '0',
	"food_revenue" numeric(12, 2) DEFAULT '0',
	"beverage_revenue" numeric(12, 2) DEFAULT '0',
	"breakfast_revenue" numeric(12, 2) DEFAULT '0',
	"bar_revenue" numeric(12, 2) DEFAULT '0',
	"minibar_revenue" numeric(12, 2) DEFAULT '0',
	"parking_revenue" numeric(12, 2) DEFAULT '0',
	"event_hall_revenue" numeric(12, 2) DEFAULT '0',
	"spa_revenue" numeric(12, 2) DEFAULT '0',
	"laundry_revenue" numeric(12, 2) DEFAULT '0',
	"telephone_revenue" numeric(12, 2) DEFAULT '0',
	"internet_revenue" numeric(12, 2) DEFAULT '0',
	"other_revenue" numeric(12, 2) DEFAULT '0',
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"available_rooms" integer DEFAULT 0,
	"occupied_rooms" integer DEFAULT 0,
	"occupancy_rate" numeric(5, 4) DEFAULT '0',
	"average_daily_rate" numeric(10, 2) DEFAULT '0',
	"revenue_per_available_room" numeric(10, 2) DEFAULT '0',
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_room_type_revenue" (
	"date" date NOT NULL,
	"room_type_id" integer NOT NULL,
	"rooms_sold" integer DEFAULT 0,
	"revenue" numeric(10, 2) DEFAULT '0',
	"average_rate" numeric(10, 2) DEFAULT '0',
	"calculated_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_room_type_revenue_date_room_type_id_pk" PRIMARY KEY("date","room_type_id")
);
--> statement-breakpoint
CREATE TABLE "monthly_revenue" (
	"month" date PRIMARY KEY NOT NULL,
	"total_reservations" integer,
	"total_revenue" numeric(12, 2),
	"room_revenue" numeric(12, 2),
	"bar_rate_revenue" numeric(12, 2),
	"corporate_rate_revenue" numeric(12, 2),
	"group_rate_revenue" numeric(12, 2),
	"congress_rate_revenue" numeric(12, 2),
	"other_rate_revenue" numeric(12, 2),
	"food_revenue" numeric(12, 2),
	"beverage_revenue" numeric(12, 2),
	"breakfast_revenue" numeric(12, 2),
	"bar_revenue" numeric(12, 2),
	"minibar_revenue" numeric(12, 2),
	"parking_revenue" numeric(12, 2),
	"event_hall_revenue" numeric(12, 2),
	"spa_revenue" numeric(12, 2),
	"laundry_revenue" numeric(12, 2),
	"telephone_revenue" numeric(12, 2),
	"internet_revenue" numeric(12, 2),
	"other_revenue" numeric(12, 2),
	"avg_occupancy_rate" numeric(5, 4),
	"avg_daily_rate" numeric(10, 2),
	"avg_revpar" numeric(10, 2),
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "yearly_revenue" (
	"year" integer PRIMARY KEY NOT NULL,
	"total_reservations" integer,
	"total_revenue" numeric(12, 2),
	"room_revenue" numeric(12, 2),
	"bar_rate_revenue" numeric(12, 2),
	"corporate_rate_revenue" numeric(12, 2),
	"group_rate_revenue" numeric(12, 2),
	"congress_rate_revenue" numeric(12, 2),
	"other_rate_revenue" numeric(12, 2),
	"food_revenue" numeric(12, 2),
	"beverage_revenue" numeric(12, 2),
	"breakfast_revenue" numeric(12, 2),
	"bar_revenue" numeric(12, 2),
	"minibar_revenue" numeric(12, 2),
	"parking_revenue" numeric(12, 2),
	"event_hall_revenue" numeric(12, 2),
	"spa_revenue" numeric(12, 2),
	"laundry_revenue" numeric(12, 2),
	"telephone_revenue" numeric(12, 2),
	"internet_revenue" numeric(12, 2),
	"other_revenue" numeric(12, 2),
	"avg_occupancy_rate" numeric(5, 4),
	"avg_daily_rate" numeric(10, 2),
	"avg_revpar" numeric(10, 2),
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" varchar(100) NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_fields" text[],
	"user_id" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"discount_type" varchar(20) NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"blackout_dates" date[],
	"min_nights" integer DEFAULT 1,
	"min_amount" numeric(10, 2),
	"max_uses" integer,
	"uses_count" integer DEFAULT 0,
	"room_type_ids" integer[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_connecting_room_id_rooms_id_fk" FOREIGN KEY ("connecting_room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_rate_adjustments" ADD CONSTRAINT "room_type_rate_adjustments_base_room_type_id_room_types_id_fk" FOREIGN KEY ("base_room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_rate_adjustments" ADD CONSTRAINT "room_type_rate_adjustments_derived_room_type_id_room_types_id_fk" FOREIGN KEY ("derived_room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_rate_adjustments" ADD CONSTRAINT "room_type_rate_adjustments_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_rates" ADD CONSTRAINT "room_type_rates_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_rates" ADD CONSTRAINT "room_type_rates_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_payment_id_payments_id_fk" FOREIGN KEY ("refunded_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_inspected_by_users_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_room_type_revenue" ADD CONSTRAINT "daily_room_type_revenue_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_permissions_resource_action" ON "permissions" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_guests_email" ON "guests" USING btree ("email") WHERE "guests"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_guests_name" ON "guests" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_guests_vip" ON "guests" USING btree ("vip_status") WHERE "guests"."vip_status" = true;--> statement-breakpoint
CREATE INDEX "idx_guests_loyalty" ON "guests" USING btree ("loyalty_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_room_types_name" ON "room_types" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_room_types_code" ON "room_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_room_types_active" ON "room_types" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_room_types_sort" ON "room_types" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rooms_number" ON "rooms" USING btree ("room_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rate_plans_code" ON "rate_plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_room_type_rate_adjustments" ON "room_type_rate_adjustments" USING btree ("base_room_type_id","derived_room_type_id","rate_plan_id");--> statement-breakpoint
CREATE INDEX "idx_room_type_rates_lookup" ON "room_type_rates" USING btree ("room_type_id","rate_plan_id","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agencies_code" ON "agencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_agencies_name" ON "agencies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_reservation_rooms_reservation" ON "reservation_rooms" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_rooms_dates" ON "reservation_rooms" USING btree ("check_in_date","check_out_date");--> statement-breakpoint
CREATE INDEX "idx_reservation_rooms_type" ON "reservation_rooms" USING btree ("room_type_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_rooms_availability" ON "reservation_rooms" USING btree ("room_id","check_in_date","check_out_date") WHERE "reservation_rooms"."room_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_reservation_rooms_type_availability" ON "reservation_rooms" USING btree ("room_type_id","check_in_date","check_out_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reservations_number" ON "reservations" USING btree ("reservation_number");--> statement-breakpoint
CREATE INDEX "idx_reservations_guest" ON "reservations" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "idx_reservations_dates" ON "reservations" USING btree ("check_in_date","check_out_date");--> statement-breakpoint
CREATE INDEX "idx_reservations_checkin_status" ON "reservations" USING btree ("check_in_date","status");--> statement-breakpoint
CREATE INDEX "idx_reservations_checkout_status" ON "reservations" USING btree ("check_out_date","status");--> statement-breakpoint
CREATE INDEX "idx_reservations_agency" ON "reservations" USING btree ("agency_id") WHERE "reservations"."agency_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_reservations_active" ON "reservations" USING btree ("check_in_date","check_out_date") WHERE "reservations"."status" IN ('confirmed', 'checked_in');--> statement-breakpoint
CREATE UNIQUE INDEX "idx_room_assignments_room_date_unique" ON "room_assignments" USING btree ("room_id","date");--> statement-breakpoint
CREATE INDEX "idx_room_assignments_reservation" ON "room_assignments" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_room_assignments_room_date" ON "room_assignments" USING btree ("room_id","date");--> statement-breakpoint
CREATE INDEX "idx_room_assignments_date" ON "room_assignments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_room" ON "room_blocks" USING btree ("room_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_type" ON "room_blocks" USING btree ("room_type_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_dates" ON "room_blocks" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_active" ON "room_blocks" USING btree ("start_date","end_date") WHERE "room_blocks"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_items_date" ON "invoice_items" USING btree ("date_of_service");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_number" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "idx_invoices_guest" ON "invoices" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_reservation" ON "invoices" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_issue_date" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_unpaid" ON "invoices" USING btree ("status","due_date") WHERE "invoices"."status" IN ('issued', 'partially_paid', 'overdue');--> statement-breakpoint
CREATE INDEX "idx_invoices_overdue" ON "invoices" USING btree ("due_date") WHERE "invoices"."status" = 'overdue';--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payments_method" ON "payments" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "idx_payments_refund" ON "payments" USING btree ("is_refund") WHERE "payments"."is_refund" = true;--> statement-breakpoint
CREATE INDEX "idx_housekeeping_room_date" ON "housekeeping_tasks" USING btree ("room_id","task_date");--> statement-breakpoint
CREATE INDEX "idx_housekeeping_assigned" ON "housekeeping_tasks" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE INDEX "idx_housekeeping_workload" ON "housekeeping_tasks" USING btree ("assigned_to","task_date","status");--> statement-breakpoint
CREATE INDEX "idx_housekeeping_current" ON "housekeeping_tasks" USING btree ("task_date","status","room_id") WHERE "housekeeping_tasks"."task_date" >= CURRENT_DATE;--> statement-breakpoint
CREATE INDEX "idx_housekeeping_type" ON "housekeeping_tasks" USING btree ("task_type","status");--> statement-breakpoint
CREATE INDEX "idx_maintenance_room" ON "maintenance_requests" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_maintenance_status" ON "maintenance_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_maintenance_assigned" ON "maintenance_requests" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE INDEX "idx_maintenance_current" ON "maintenance_requests" USING btree ("scheduled_date","status","room_id") WHERE "maintenance_requests"."scheduled_date" >= CURRENT_DATE;--> statement-breakpoint
CREATE INDEX "idx_maintenance_open_urgent" ON "maintenance_requests" USING btree ("priority","status") WHERE "maintenance_requests"."status" = 'open' AND "maintenance_requests"."priority" = 'urgent';--> statement-breakpoint
CREATE INDEX "idx_daily_rate_date" ON "daily_rate_revenue" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_daily_revenue_date" ON "daily_revenue" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_daily_room_type_date" ON "daily_room_type_revenue" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_monthly_revenue_month" ON "monthly_revenue" USING btree ("month");--> statement-breakpoint
CREATE INDEX "idx_yearly_revenue_year" ON "yearly_revenue" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_audit_log_table_record" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_timestamp" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_promotions_code" ON "promotions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_promotions_active" ON "promotions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_promotions_dates" ON "promotions" USING btree ("valid_from","valid_to") WHERE "promotions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_promotions_active_valid" ON "promotions" USING btree ("is_active","valid_from","valid_to") WHERE "promotions"."is_active" = true AND "promotions"."valid_from" <= CURRENT_DATE AND "promotions"."valid_to" >= CURRENT_DATE;