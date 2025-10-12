Auth Configuration Auth Hooks
Auth Hooks
Use HTTP or Postgres Functions to customize your authentication flow
What is a hook
A hook is an endpoint that allows you to alter the default Supabase Auth flow at specific
execution points. Developers can use hooks to add custom behavior that's not supported
natively.
Hooks help you:
The following hooks are available:
Hook Available on Plan
Free, Pro
Free, Pro
Free, Pro
Teams and Enterprise
Teams and Enterprise
Track the origin of user signups by adding metadata
Improve security by adding additional checks to password and multi-factor authentication
Support legacy systems by integrating with identity credentials from external
authentication systems
Add additional custom claims to your JWT
Send authentication emails or SMS messages through a custom provider
Custom Access Token
Send SMS
Send Email
MFA Verification Attempt
Password Verification Attempt
Auth
DOCS Search
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://supabase.com/docs/guides/auth/auth-hooks?queryGroups=language&language=sql 1/8
Supabase supports 2 ways to in your project:
A can be configured as a hook. The function should take in a single
argument -- the event of type JSONB -- and return a JSONB object. Since the Postgres
function runs on your database, the request does not leave your project's instance.
Security model
Sign the payload and grant permissions selectively in order to guard the integrity of the
payload.
When you configure a Postgres function as a hook, Supabase will automatically apply the
following grants to the function for these reasons:
You will need to alter your row-level security (RLS) policies to allow the supabase_auth_admin
role to access tables that you have RLS policies on. You can read more about RLS policies
configure a hook
Postgres Function HTTP Endpoint
Postgres function
SQL HTTP
Allow the supabase_auth_admin role to execute the function. The supabase_auth_admin
role is the Postgres role that is used by Supabase Auth to make requests to your database.
Revoke permissions from other roles (e.g. anon , authenticated , public ) to ensure the
function is not accessible by Supabase Data APIs.
1
2
3
4
5
6
7
8
9
10
11
12
-- Grant access to function to supabase_auth_admin
grant execute
on function public.custom_access_token_hook
to supabase_auth_admin;
-- Grant access to schema to supabase_auth_admin
grant usage on schema public to supabase_auth_admin;
-- Revoke function permissions from authenticated, anon and public
revoke execute
on function public.custom_access_token_hook
from authenticated, anon, public;
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://supabase.com/docs/guides/auth/auth-hooks?queryGroups=language&language=sql 2/8
.
Alternatively, you can create your Postgres function via the dashboard with the security
definer tag. The security definer tag specifies that the function is to be executed with the
privileges of the user that owns it.
Currently, functions created via the dashboard take on the postgres role. Read more about
the security definer tag
Using Hooks
Developing
Let us develop a Hook locally and then deploy it to the cloud. As a recap, here’s a list of
available Hooks
Hook
Suggested
Function Name When it is called What it Does
Send SMS send_sms Each time an SMS is
sent
Allows you to customize message
content and SMS Provider
Send Email send_email Each time an Email is
sent
Allows you to customize message
content and Email Provider
Custom Access
Token
custom_access_to
ken
Each time a new JWT
is created
Returns the claims you wish to be
present in the JWT.
MFA Verification
Attempt
mfa_verification
_attempt
Each time a user tries
to verify an MFA
factor.
Returns a decision on whether to reject
the attempt and future ones, or to allow
the user to keep trying.
Password
Verification
Attempt
password_verific
ation_attempt
Each time a user tries
to sign in with a
password.
Return a decision whether to allow the
user to reject the attempt, or to allow the
user to keep trying.
Edit config.toml to set up the Auth Hook locally.
here
in our database guide
SQL HTTP
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://supabase.com/docs/guides/auth/auth-hooks?queryGroups=language&language=sql 3/8
Modify the
auth.hook.<hook_name>
field and set
uri
to a value of
pg-functions://postgres/<schema>/<function_name>
You need to assign additional permissions so that Supabase Auth can access the hook as wellas the tables it interacts with.
The
supabase_auth_admin
role does not have permissions to the
public
schema. You needto grant the role permission to execute your hook:
You also need to grant usage to
supabase_auth_admin
:
Also revoke permissions from the
authenticated
and
anon
roles to ensure the function isnot accessible by Supabase Serverless APIs.
For security, we recommend against the use the
security definer
tag. The
securitydefiner
tag specifies that the function is to be executed with the privileges of the user thatowns it. When a function is created via the Supabase dashboard with the tag, it will have the
1
2
3
[auth.hook.<hook_name>]
enabled = true
uri = "pg-functions://...."
1
2
3
grant
execute
on
function
public
.
custom_access_token_hook
to
supabase_auth_admin;
1
grant
usage
on
schema
public
to
supabase_auth_admin;
1
2
3
revoke
execute
on
function
public
.
custom_access_token_hook
from
authenticated, anon;
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://supabase.com/docs/guides/auth/auth-hooks?queryGroups=language&language=sql 4/8
extensive permissions of the
postgres
role which make it easier for undesirable actions tooccur.
We recommend that you do not use any tag and explicitly grant permissions to
supabase_auth_admin
as described above.
Read more about
security definer
tag
.
Once done, save your Auth Hook as a migration in order to version the Auth Hook and share itwith other team members. Run
to create a migration.
Here is an example hook signature:
You can visit
SQL Editor > Templates
for hook templates.
Deploying
In the dashboard, navigate to
and select the appropriate functiontype (SQL or HTTP) from the dropdown menu.
Error handling
in our database guide
supabase migration new
If you're using the Supabase SQL Editor, there's an issue when using the
?
(
Does the stringexist as a top-level key within the JSON value?
) operator. Use a direct connection to thedatabase if you need to use it when defining a function.
1
2
3
4
5
6
7
8
9
10
11
create or replace
function
public
.custom_access_token_hook(
event
jsonb)
returns
jsonb
language
plpgsql
as
$$
declare
-- Insert variables here
begin
-- Insert logic here
return
event
;
end
;
$$;
Authentication > Hooks
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://supabase.com/docs/guides/auth/auth-hooks?queryGroups=language&language=sql 5/8
You should return an error when facing a runtime error. Runtime errors are specific to your
application and arise from specific business rules rather than programmer errors.
Runtime errors could happen when:
The error is a JSON object and has the following properties:
Here's an example:
Errors returned from a Postgres Hook are not retry-able. When an error is returned, the error is
propagated from the hook to Supabase Auth and translated into a HTTP error which is
returned to your application. Supabase Auth will only take into account the error and disregard
the rest of the payload.
Outside of runtime errors, both HTTP Hooks and Postgres Hooks return timeout errors.
Postgres Hooks have 2 seconds to complete processing while HTTP Hooks should complete in
5 seconds. Both HTTP Hooks and Postgres Hooks are run in a transaction do limit the duration
of execution to avoid delays in authentication process.
The user does not have appropriate permissions
The event payload received does not have required claims.
The user has performed an action which violates a business rule.
The email or phone provider used in the webhook returned an error.
SQL HTTP
error An object that contains information about the error.
http_code A number indicating the HTTP code to be returned. If not set, the code is
HTTP 500 Internal Server Error.
message A message to be returned in the HTTP response. Required.
1
2
3
4
5
6
{
"error": {
"http_code": 429,
"message": "You can only verify a factor once every 10 seconds."
}
}
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://supabase.com/docs/guides/auth/auth-hooks?queryGroups=language&language=sql 6/8
Need some help?
Contact support
Latest product updates?
See Changelog
Something's not right?
Check system status
Available Hooks
Each Hook description contains an example JSON Schema which you can use in conjunctionwith
in order to generate a mock payload. For HTTP Hooks, you can alsouse
to simulate a request.
Edit this page on GitHub
JSON Schema Faker
the Standard Webhooks Testing Tool
Custom Access Token
Customize the access token issued by Supabase Auth
Send SMS
Use a custom SMS provider to send authentication messages
Send Email
Use a custom email provider to send authentication messages
MFA Verification
Add additional checks to the MFA verification flow
Password verification
Add additional checks to the password verification flow
7/1/25, 12:29 PM Auth Hooks | Supabase Docs
https://