CREATE INDEX "email_tokens_user_id_idx" ON "email_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_members_user_id_idx" ON "game_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saves_user_id_idx" ON "saves" USING btree ("user_id");