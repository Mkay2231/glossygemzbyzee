/* Glossy Gems by Zee: fixed brand details.
   Products, prices, the sale, delivery fees and contact numbers are managed in the dashboard at /admin
   and loaded from /api/store. The values below are only the starting point before that first load. */
window.GG = {
  brand: {
    name: 'Glossy Gems by Zee',
    short: 'Glossy Gems',
    tagline: 'A collection of grace and sophistication'
  },

  /* Registered business details, shown in the footer and the policies. */
  business: {
    legalName: 'GLOSSYGEMZ BY ZEE ENTERPRISES',
    cac: '8636509',
    place: 'Magboro, Ogun State, Nigeria',
    email: 'glossygemzbyzee@gmail.com'
  },

  contact: { whatsapp: '2349072747685', instagram: 'glossygem_by_zee', tiktok: 'glossygems.by.zee', snapchat: 'zhannie_xoxo' },
  sale: null,
  delivery: { lagos: null, other: null },
  policies: { delivery: '', returns: '' },

  types: ['Earrings', 'Necklaces', 'Bracelets', 'Rings', 'Lip Gloss', 'Combos'],
  giftType: 'Gift items',          // sold only in the Gift Builder
  catalog: [],
  loaded: false,

  /* Standard US ring sizes by inside diameter. Shown on the help page, labelled as US sizes. */
  ringSizes: [['5', '15.7 mm'], ['6', '16.5 mm'], ['7', '17.3 mm'], ['8', '18.1 mm'], ['9', '18.9 mm'], ['10', '19.8 mm']],

  states: ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
    'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
    'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
    'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']
};
