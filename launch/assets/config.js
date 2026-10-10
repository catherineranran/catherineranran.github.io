/*
  Settings for ranranli.net/launch.

  Your tasks and settings are saved in Supabase as ONE encrypted blob. The key comes from
  your password, so neither Supabase nor this public repo ever holds anything readable.
  The publishable key below is meant to be public: on its own it can't read or change
  anything (see launch/supabase.sql).
*/
window.LAUNCH_CONFIG = {
  supabaseUrl: 'https://dcucmzobeolwvhibavfl.supabase.co',
  supabaseKey: 'sb_publishable_T_E73ky6YPaN7ZYvT-xE-A_J88sI5Oi',
  vaultId: 'ranran-launch',
  unlockHours: 8,
  // Google sign-in for the calendar (public client ID; only works on https://ranranli.net).
  googleClientId: '270543400403-qfeirftcu5ev9tfbfa6jbilq804rf3db.apps.googleusercontent.com'
};
