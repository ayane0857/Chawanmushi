CREATE TABLE "temp" (
	"id" serial PRIMARY KEY NOT NULL,
	"minecraftuuid" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "temp_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"minecraftuuid" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_minecraftuuid_unique" UNIQUE("minecraftuuid"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
