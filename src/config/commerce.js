// src/config/commerce.js
// Central place for Stripe links + Social profiles.
// Values can be overridden via Vite envs at build time.

export const STRIPE_ALL_LINK =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK_ALL ||
  "https://buy.stripe.com/fZu5kDbCG9n1gdrgJl2Nq05"; // App + add-ons on checkout

export const PAYLINKS = {
  // Individual product payment links (open in a new tab)
  webinars:
    import.meta.env.VITE_PAYLINK_WEBINARS ||
    "https://buy.stripe.com/9B628r6im8iXf9n64H2Nq03",
  courses:
    import.meta.env.VITE_PAYLINK_COURSES ||
    "https://buy.stripe.com/28E5kDeOS2YDd1f50D2Nq04",
  coaching:
    import.meta.env.VITE_PAYLINK_COACHING ||
    "https://buy.stripe.com/00w14ndKO6aP6CR64H2Nq02",

  // Optional: if you ever sell the App separately
  app: import.meta.env.VITE_PAYLINK_APP || "",
};

// Social profiles (official links)
export const SOCIAL = {
  youtube:
    import.meta.env.VITE_SOCIAL_YT ||
    "http://www.youtube.com/@quantum.edge.fx1",
  instagram:
    import.meta.env.VITE_SOCIAL_IG ||
    "https://www.instagram.com/quantumedge.fx/",
  tiktok:
    import.meta.env.VITE_SOCIAL_TT ||
    "http://tiktok.com/@quantum.edge.fx",
  facebook:
    import.meta.env.VITE_SOCIAL_FB ||
    "https://www.facebook.com/profile.php?id=61579183787818",

  // Community links (optional – used elsewhere on the site)
  discord: import.meta.env.VITE_SOCIAL_DISCORD || "https://discord.gg/AnNCXCef",
  groupme:
    import.meta.env.VITE_SOCIAL_GROUPME ||
    "https://groupme.com/join_group/110861155/abrXDGzA",
};
