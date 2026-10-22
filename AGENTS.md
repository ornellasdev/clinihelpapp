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
- Signed-in app pages live under `src/routes/_authenticated/_clinic/`; `_clinic.tsx` is the shared shell (sidebar + mobile bottom nav) and loads the current user via `meQuery`. Why: one place for nav and role-aware UI.
- Access control is enforced in the database (RLS + `has_role`, `is_staff`, `is_gestor`, `has_especialidade`, `can_view_especialidade`); `src/lib/permissions.ts` only mirrors those rules to hide/show UI. Why: UI checks alone are bypassable.
- Management policies use `is_gestor` (master or administrador); clinical-note access stays on `has_role(master)`/`can_view_especialidade`, and non-master gestors cannot grant master, touch master accounts, or link specialties to themselves (RLS + server-fn checks). Why: the administrador role must never reach clinical notes, directly or by escalation.
- Clinical notes (`evolucoes`) are visible only to the master role or professionals linked to that specialty; author name/registration are snapshotted by a DB trigger. Why: legal record integrity.
- Session money data lives in `atendimento_financeiro` (separate from `agendamentos`), auto-created by trigger from `profissional_config` defaults. Why: reception can see the schedule without seeing values (segregation of duties).
- Room/professional double-booking is blocked by Postgres exclusion constraints on `agendamentos`; UI maps the constraint names to friendly messages in `erroAmigavel`. Why: conflicts must be impossible, not just discouraged.
- Account creation, deactivation and password resets go through server functions in `src/lib/equipe.functions.ts` (service-role, master-checked). Public signup is disabled; the first master is created via `criarMasterInicial`, which locks once a master exists.
- Data reads use `queryOptions` in `src/lib/queries.ts` with the browser client (RLS applies), loaded via route loaders + `useSuspenseQuery`.
- Business rules have tests in `src/lib/regras.test.ts`.
