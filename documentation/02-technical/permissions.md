# Permissions

| Resource                   | Visitor          | Signed-in user    | Salon staff              | Operator                                          |
| -------------------------- | ---------------- | ----------------- | ------------------------ | ------------------------------------------------- |
| Create personal task       | Allowed          | Allowed           | Allowed                  | Denied                                            |
| Read own task              | Current session  | Owner             | Authorized salon session | Redacted support only                             |
| Delete personal media      | Current session  | Owner             | Own task                 | On verified request                               |
| Read operations metrics    | Denied           | Denied            | Tenant aggregate         | Platform aggregate                                |
| Change monthly user quota  | Denied           | Denied            | Denied                   | Allowed; cannot set below used and reserved count |
| Change model configuration | Denied           | Denied            | Denied                   | Allowed; API keys remain masked                   |
| Read management audit log  | Denied           | Denied            | Denied                   | Allowed                                           |
| Activate Personal Plus     | Sign-in required | Own license only  | Denied                   | Denied                                            |
| Activate Salon Pro         | Denied           | Salon owner only  | Denied                   | Denied                                            |
| Use Salon Pro allowance    | Denied           | Salon owner only  | Same salon owner plan    | Denied                                            |
| Manage billing             | Denied           | Own Gumroad account | Salon owner only       | Redacted support only                             |

Anonymous users receive an HTTP-only session cookie. Visitor task changes require the matching session; signed-in task changes require the owning user ID. The operations console requires `ADMIN_ACCESS_KEY` and an HTTP-only admin cookie. Production authorization belongs in every route handler, never only in proxy/middleware.

Quota and model changes are committed in the same database transaction as their audit record. If audit persistence fails, the business change is rolled back.

Subscription entitlements are never granted from browser redirects. Only a successful server-side Gumroad License API verification may change persisted subscription state. A license and subscription identifier can be bound to only one account.
