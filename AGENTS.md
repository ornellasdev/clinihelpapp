<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Multi-tenant: one database, every business row carries `clinica_id` (default `minha_clinica()`), and every RLS policy and storage policy filters on `clinica_id = (select minha_clinica())`; the `garantir_mesma_clinica` trigger blocks cross-clinic references. Service-role inserts must set `clinica_id` explicitly. New business tables need the column, the policies and the trigger. Why: clinics must never see each other's data.
- Clinic pages live under `src/routes/_authenticated/$clinica/` (URL `/{slug}/...`); `$clinica/route.tsx` is the shell, loads `meQuery` (`meu_contexto` RPC) and redirects users to their own clinic's slug. Links pass `params={{ clinica }}` via `useClinica()`. Why: each clinic has its own address and nav lives in one place.
- Developer (supreme) access: emails in `desenvolvedores` + session at `aal2` (Google sign-in + TOTP on `/dev`) make `eh_dev()` true; then role helpers return true and `minha_clinica()` is the developer's `clinica_ativa`, switched by `dev_entrar_clinica`. Clinics and their first master are created in `src/lib/dev.functions.ts`. Why: no Google+2FA, no supreme access.
- Staff sessions only reach clinic data when `acesso_seguro()` holds (session `aal2` and `profiles.senha_temporaria` false): `minha_clinica()`/`has_role`/`is_staff` return null/false otherwise, and `meu_contexto().pendencia` tells `/auth` which step is missing. Passwords set by master/admin/dev are always temporary; the person replaces them via `definirMinhaSenha` (own-session password update, admin fallback + re-login). Password rules live in `src/lib/senha.ts`. Why: mandatory own password + 2FA must be enforced by the database, not the UI.
- Access control is enforced in the database (RLS + `has_role`, `is_staff`, `is_gestor`, `has_especialidade`, `can_view_especialidade`); `src/lib/permissions.ts` only mirrors those rules to hide/show UI. Why: UI checks alone are bypassable.
- Management policies use `is_gestor` (master or administrador); clinical-note access stays on `has_role(master)`/`can_view_especialidade`, and non-master gestors cannot grant master, touch master accounts, or link specialties to themselves (RLS + server-fn checks). Why: the administrador role must never reach clinical notes, directly or by escalation.
- Clinical notes (`evolucoes`) are visible only to the master role or professionals linked to that specialty; author name/registration are snapshotted by a DB trigger. Why: legal record integrity.
- Session money data lives in `atendimento_financeiro` (separate from `agendamentos`), auto-created by trigger from `profissional_config` defaults. Why: reception can see the schedule without seeing values (segregation of duties).
- Room/professional double-booking is blocked by Postgres exclusion constraints on `agendamentos`; UI maps the constraint names to friendly messages in `erroAmigavel`. Why: conflicts must be impossible, not just discouraged.
- Account creation, deactivation and password resets go through server functions in `src/lib/equipe.functions.ts` (service-role, master-checked). Public signup is disabled; each clinic's first master is created by the developer panel (`criarClinica`). Team functions only touch accounts of the caller's clinic.
- Data reads use `queryOptions` in `src/lib/queries.ts` with the browser client (RLS applies), loaded via route loaders + `useSuspenseQuery`.
- Session prices come from the patient's plan: `convenios` (name/type, readable by all staff) + `convenio_valores` (price, gestor/financeiro only); `criar_financeiro_agendamento` uses the plan price, falling back to `profissional_config`. Why: reception picks the plan without seeing prices (SOD).
- Audit trail lives in `auditoria`, written only by the `auditar_alteracao` trigger (browser-client changes), `registrar_acesso` RPC (login/logout) and `src/lib/auditoria.server.ts` (service-role team actions, where `auth.uid()` is null and the trigger skips). Read-only for master/administrador; prontuário (`evolucoes`) rows master-only. New business tables need the trigger added. Why: tamper-proof history without exposing clinical notes to administrador.
- Subdirectories have their own `AGENTS.md` (e.g. `src/lib/AGENTS.md`: exports, Asaas charges, indicators, waiting list, tests) — read it before changing files there.
