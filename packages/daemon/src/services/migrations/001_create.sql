CREATE TABLE "logs" (
	"id"	TEXT UNIQUE,
	"created"	TEXT NOT NULL,
	"updated"	TEXT NOT NULL,
	"bundleId"	TEXT NOT NULL,
	"message"	TEXT NOT NULL,
	"stream"	TEXT NOT NULL,
	PRIMARY KEY("id")
)

CREATE INDEX "updated" ON "logs" (
	"updated"	DESC
)

