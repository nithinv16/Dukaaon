Auth Third-party auth Firebase Auth
Firebase Auth
Use Firebase Auth with your Supabase project
Firebase Auth can be used as a third-party authentication provider alongside Supabase Auth,
or standalone, with your Supabase project.
Getting started
Setup the Supabase client library
Creating a client for the Web is as easy as passing the accessToken async function. This
function should (or null if no such user) is
found.
First you need to add an integration to connect your Supabase project with your Firebase
project. You will need to get the Project ID in the .
1
Firebase Console
Add a new Third-party Auth integration 2 in your project's Authentication settings.
If you are using Third Party Auth when self hosting, create and attach restrictive RLS
policies to all tables in your public schema, Storage and Realtime to prevent unauthorized
access from unrelated Firebase projects.
3
4 Assign the role: 'authenticated' custom user claim to all your users.
5 Finally set up the Supabase client in your application.
TypeScript Flutter Swift (iOS) Kotlin (Android) Kotlin (Multiplatform)
return the Firebase Auth JWT of the current user
1 import { createClient } from '@supabase/supabase-js'
Auth
DOCS Search
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 1/7
Make sure the all users in your application have the
role: 'authenticated'
set.If you're using the
onCreate
Cloud Function to add this custom claim to newly signed upusers, you will need to call
getIdToken(/* forceRefresh */ true)
immediately after sign upas the
onCreate
function does not run synchronously.
Add a new Third-Party Auth integration to your project
In the dashboard navigate to your project's
and find the Third-PartyAuth section to add a new integration.
In the CLI add the following config to your
supabase/config.toml
file:
Adding an extra layer of security to your project's RLS policies(self-hosting only)
Firebase Auth uses a single set of JWT signing keys for all projects. This means that JWTsissued from an unrelated Firebase project to yours could access data in your Supabase project.
When using the Supabase hosted platform, JWTs coming from Firebase project IDs you havenot registered will be rejected before they reach your database. When self-hosting
2
3
4
5
6
7
const
supabase
=
createClient
(
'
https://<supabase-project>.supabase.co
'
,
'
SUPABASE_
accessToken
:
async
()
=>
{
return
(
await
firebase
.
auth
()
.
currentUser
?.
getIdToken
(
/* forceRefresh */
false
},
}
)
custom claim
Authentication settings
1
2
3
[
auth
.
third_party
.
firebase
]
enabled
=
true
project_id
=
"
<id>
"
Follow this section carefully to prevent unauthorized access to your project's data when self-hosting.
When using the Supabase hosted platform, following this step is optional.
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 2/7
implementing this mechanism is your responsibility. An easy way to guard against this is tocreate and maintain the following RLS policies for
all of your tables in the
public
schema
.You should also attach this policy to
buckets or
channels.
It's recommended you use a
.
Restrictive RLS policies differ from regular (or permissive) policies in that they use the
asrestrictive
clause when being defined. They do not grant permissions, but rather restrictany existing or future permissions. They're great for cases like this where the technicallimitations of Firebase Auth remain separate from your app's logic.
This is an example of such an RLS policy that will restrict access to only your project's(denoted with
<firebase-project-id>
) users, and not any other Firebase project.
If you have a lot of tables in your app, or need to manage complex RLS policies for
or
it can be useful to define a
that performs the check to cutdown on duplicate code. For example:
Storage
Realtime
restrictive Postgres Row-Level Security policy
Postgres has two types of policies: permissive and restrictive. This example uses restrictivepolicies so make sure you don't omit the
as restrictive
clause.
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
13
 
create
policy
"
Restrict access to Supabase Auth and Firebase Auth for project ID
on
table_name
as
restrictive
to
authenticated
using
(
(
auth
.
jwt
()
->>
'
iss
'
=
'
https://<project-ref>.supabase.co/auth/v1
'
)
or
(
auth
.
jwt
()
->>
'
iss
'
=
'
https://securetoken.google.com/<firebase-project-id
and
auth
.
jwt
()
->>
'
aud
'
=
'
<firebase-project-id>
'
)
);
Storage
Realtime
stable Postgres function
1
2
3
create
function
public
.is_supabase_or_firebase_project_jwt
()
returns
bool
language
sql
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 3/7
Make sure you substitute
<project-ref>
with your Supabase project's ID and the
<firebase-project-id>
to your Firebase Project ID. Then the restrictive policies on all your tables,buckets and channels can be simplified to be:
Assign the "role" custom claim
Your Supabase project inspects the
role
claim present in all JWTs sent to it, to assign thecorrect Postgres role when using the Data API, Storage or Realtime authorization.
By default, Firebase JWTs do not contain a
role
claim in them. If you were to send such aJWT to your Supabase project, the
anon
role would be assigned when executing thePostgres query. Most of your app's logic will be accessible by the
authenticated
role.
Use Firebase Authentication functions to assign the authenticated role
You have two choices to set up a Firebase Authentication function depending on your Firebaseproject's configuration:
4
5
6
7
8
9
10
11
12
13
14
stable
returns
null
on
null
input
return
(
(
auth
.
jwt
()
->>
'
iss
'
=
'
https://<project-ref>.supabase.co/auth/v1
'
)
or
(
auth
.
jwt
()
->>
'
iss
'
=
concat
(
'
https://securetoken.google.com/<firebase-pro
and
auth
.
jwt
()
->>
'
aud
'
=
'
<firebase-project-id>
'
)
);
1
2
3
4
5
create
policy
"
Restrict access to correct Supabase and Firebase projects
"
on
table_name
as
restrictive
to
authenticated
using
((
select
public
.
is_supabase_or_firebase_project_jwt
()
)
is
true);
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 4/7
Note that instead of using
customClaims
you can instead use
sessionClaims
. The differenceis that
session_claims
are not saved in the Firebase user profile, but remain valid for as longas the user is signed in.
Finally deploy your functions for the changes to take effect:
Easiest: Use a
but this is only available if yourproject uses
.
1
blocking Firebase Authentication function
Firebase Authentication with Identity Platform
Manually assign the custom claims to all users with the
and define an
to persist the role to all newly createdusers.
2
admin SDK
onCreate
Firebase Authentication Cloud Function
Node.js (Blocking Functions Gen 2)
Python (Blocking Functions Gen 2)
onCreate Cloud Function in Node.js
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
13
14
15
16
17
18
19
20
21
 
import
{
beforeUserCreated
,
beforeUserSignedIn
}
from
'
firebase-functions/v2/iden
export
const
beforecreated
=
beforeUserCreated
(
(
event
)
=>
{
return
{
customClaims
:
{
// The Supabase project will use this role to assign the `authenticated`
// Postgres role.
role
:
'
authenticated
'
,
},
}
}
)
export
const
beforesignedin
=
beforeUserSignedIn
(
(
event
)
=>
{
return
{
customClaims
:
{
// The Supabase project will use this role to assign the `authenticated`
// Postgres role.
role
:
'
authenticated
'
,
},
}
}
)
1
firebase deploy --only functions
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 5/7
Note that these functions are only called on new sign-ups and sign-ins. Existing users will nothave these claims in their ID tokens. You will need to use the admin SDK to assign the rolecustom claim to all users. Make sure you do this after the blocking Firebase Authenticationfunctions as described above are deployed.
Use the admin SDK to assign the role custom claim to all users
You need to run a script that will assign the
role: 'authenticated'
custom claim to all ofyour existing Firebase Authentication users. You can do this by combining the
and
admin APIs. An example script is provided below:
After all users have received the
role: 'authenticated'
claim, it will appear in all newlyissued ID tokens for the user.
list users
setcustom user claims
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
13
14
15
16
17
18
19
20
21
22
23
24
25
26
'
use strict
'
;
const
{
initializeApp
}
=
require
(
'
firebase-admin/app
'
)
;
const
{
getAuth
}
=
require
(
'
firebase-admin/auth
'
)
;
initializeApp
()
;
async
function
setRoleCustomClaim
()
=>
{
let
nextPageToken
=
undefined
do
{
const
listUsersResult
=
await
getAuth
()
.
listUsers
(
1000
,
nextPageToken
)
nextPageToken
=
listUsersResult
.
pageToken
await
Promise
.
all
(
listUsersResult
.
users
.
map
(
async
(
userRecord
)
=>
{
try
{
await
getAuth
()
.
setCustomUserClaims
(
userRecord.id
,
{
role
:
'
authenticated
'
})
}
catch (error) {
console.
error
(
'
Failed to set custom role for user
'
,
userRecord.id
)
}
})
}
while
(
nextPageToken
);
};
setRoleCustomClaim
()
.
then
(
()
=>
process
.
exit
(
0
))
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 6/7
Need some help?
Contact support
Latest product updates?
See Changelog
Something's not right?
Check system status
© Supabase Inc
—
Contributing
Author Styleguide
Open Source
SupaSquad
Privacy Settings
Edit this page on GitHub
6/30/25, 4:00 PM Firebase Auth | Supabase Docs
https://supabase.com/docs/guides/auth/third-party/firebase-auth 7/7