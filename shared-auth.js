// Shared allowlist for Argos practice + assessment pages.
const ALLOWED_USERS = {
  "dishikamore205@gmail.com": "Dishika More",
  "fatimagoshiya5@gmail.com": "Goshiya Fatima",
  "dubeyrishika53@gmail.com": "Rishika Dubey",
  "kaharashish657@gmail.com": "Ashish Kahar",
  "ramji@gmail.com": "Amrendra Pratap Singh",
  "murtuza21@gmail.com": "Murtaza Ali",
  "jaknoreshubham@gmail.com": "Shubham Jaknore",
  "abhaysinghhrr744@gmail.com": "Abhay Rathore",
  "poojaverma462023@gmail.com": "Pooja Verma",
  "raiaman9122@gmail.com": "Aman Rai",
  "syedrayyansajid@gmail.com": "Syed Rayyan Sajid",
  "adnan119786@gmail.com": "Mohannad Adnan",
  "garimamukati81@gmail.com": "Garima Mukati",
  "khantahoor568@gmail.com": "Tahur Khan",
  "vaishnavisharma11505@gmail.com": "Vaishnavi Sharma",
  "mahakvishwakarma848@gmail.com": "Mahak Vishwakarma",
  "riyanagwani3032004@gmail.com": "Riyan Agwani",
  "yashtupkar6@gmail.com": "Yash Tupkar",
  "utkarshchurariya19@gmail.com": "Utkarsh Churariya",
  "murtuza33@gmail.com": "Murtuza Ali",
  "jiyavishwakarma5582@gmail.com": "Jiya Vishwakarma",
  "Azizsaniyaa@gmail.com": "Aziz Saniya",
};

function lookupAllowedUser(email) {
  const key = (email || "").trim().toLowerCase();
  const name = ALLOWED_USERS[key];
  return name ? { email: key, name } : null;
}
