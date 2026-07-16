export type Category = {
  id: string;
  label: string;
  icon: string; // lucide name
};

export const categories: Category[] = [
  { id: "mode", label: "Mode", icon: "Shirt" },
  { id: "electro", label: "Électronique", icon: "Smartphone" },
  { id: "alim", label: "Alimentation", icon: "Apple" },
  { id: "beaute", label: "Beauté", icon: "Sparkles" },
  { id: "maison", label: "Maison", icon: "Sofa" },
  { id: "occasion", label: "Occasion", icon: "Recycle" },
  { id: "services", label: "Services", icon: "Wrench" },
  { id: "artisanat", label: "Artisanat", icon: "Palette" },
];

export type Shop = {
  id: string;
  name: string;
  logo: string; // emoji / letter
  cover: string;
  city: string;
  category: string;
  verified: boolean;
  rating: number;
  reviewsCount: number;
  sales: number;
  since: string;
  distanceKm: number;
  openNow: boolean;
  hours: string;
  lat: number;
  lng: number;
  description: string;
};

export const shops: Shop[] = [
  {
    id: "s1",
    name: "Chez Aïcha Mode",
    logo: "🧵",
    cover: "linear-gradient(135deg,#4a2c2a,#8b4b3a)",
    city: "Yaoundé, Bastos",
    category: "mode",
    verified: true,
    rating: 4.8,
    reviewsCount: 142,
    sales: 380,
    since: "2022",
    distanceKm: 1.2,
    openNow: true,
    hours: "08h - 19h",
    lat: 3.8756,
    lng: 11.5164,
    description: "Créations wax, tenues sur-mesure et accessoires faits main.",
  },
  {
    id: "s2",
    name: "TechDouala",
    logo: "📱",
    cover: "linear-gradient(135deg,#1a3a52,#2e6b8a)",
    city: "Douala, Akwa",
    category: "electro",
    verified: true,
    rating: 4.6,
    reviewsCount: 89,
    sales: 210,
    since: "2021",
    distanceKm: 3.4,
    openNow: true,
    hours: "09h - 20h",
    lat: 4.0511,
    lng: 9.7679,
    description: "Smartphones neufs et reconditionnés, garantie 6 mois.",
  },
  {
    id: "s3",
    name: "Marché Frais Mokolo",
    logo: "🥭",
    cover: "linear-gradient(135deg,#2d5a3d,#87a878)",
    city: "Yaoundé, Mokolo",
    category: "alim",
    verified: false,
    rating: 4.3,
    reviewsCount: 54,
    sales: 620,
    since: "2023",
    distanceKm: 0.8,
    openNow: true,
    hours: "06h - 18h",
    lat: 3.8801,
    lng: 11.5021,
    description: "Fruits, légumes et produits vivriers du jour.",
  },
  {
    id: "s4",
    name: "Beauté Bafoussam",
    logo: "💄",
    cover: "linear-gradient(135deg,#5c2018,#c17c74)",
    city: "Bafoussam, Centre",
    category: "beaute",
    verified: true,
    rating: 4.9,
    reviewsCount: 203,
    sales: 512,
    since: "2020",
    distanceKm: 5.6,
    openNow: false,
    hours: "10h - 19h",
    lat: 5.4781,
    lng: 10.4176,
    description: "Cosmétiques, perruques et soins naturels.",
  },
  {
    id: "s5",
    name: "Artisans du Kilimandjaro",
    logo: "🪵",
    cover: "linear-gradient(135deg,#6b3a2a,#cd7f32)",
    city: "Douala, Bonanjo",
    category: "artisanat",
    verified: true,
    rating: 4.7,
    reviewsCount: 76,
    sales: 145,
    since: "2019",
    distanceKm: 2.1,
    openNow: true,
    hours: "08h - 17h",
    lat: 4.0435,
    lng: 9.6987,
    description: "Sculptures, masques et objets en bois massif.",
  },
  {
    id: "s6",
    name: "Maison Deco+",
    logo: "🛋️",
    cover: "linear-gradient(135deg,#2d3748,#718096)",
    city: "Yaoundé, Nlongkak",
    category: "maison",
    verified: false,
    rating: 4.1,
    reviewsCount: 31,
    sales: 92,
    since: "2024",
    distanceKm: 2.9,
    openNow: true,
    hours: "09h - 18h",
    lat: 3.8912,
    lng: 11.5233,
    description: "Meubles, textiles et déco pour toute la maison.",
  },
];

export type Product = {
  id: string;
  shopId: string;
  name: string;
  price: number; // XAF
  category: string;
  condition: "Neuf" | "Occasion";
  emoji: string;
  bg: string;
  likes: number;
  description: string;
};

export const products: Product[] = [
  { id: "p1", shopId: "s1", name: "Robe wax fleurie", price: 18500, category: "mode", condition: "Neuf", emoji: "👗", bg: "linear-gradient(135deg,#c44569,#f8c8d8)", likes: 84, description: "Robe en tissu wax authentique, taille M." },
  { id: "p2", shopId: "s1", name: "Boubou brodé homme", price: 32000, category: "mode", condition: "Neuf", emoji: "🥻", bg: "linear-gradient(135deg,#0c2340,#2d8a9e)", likes: 41, description: "Boubou brodé main, coton premium." },
  { id: "p3", shopId: "s2", name: "iPhone 12 128Go", price: 285000, category: "electro", condition: "Occasion", emoji: "📱", bg: "linear-gradient(135deg,#1a1a1a,#4a4a4a)", likes: 156, description: "Reconditionné, batterie 92%, garantie 6 mois." },
  { id: "p4", shopId: "s2", name: "Écouteurs sans fil", price: 15000, category: "electro", condition: "Neuf", emoji: "🎧", bg: "linear-gradient(135deg,#141432,#4f46e5)", likes: 62, description: "Bluetooth 5.3, autonomie 24h." },
  { id: "p5", shopId: "s3", name: "Panier de mangues", price: 3500, category: "alim", condition: "Neuf", emoji: "🥭", bg: "linear-gradient(135deg,#e85d3a,#f7931e)", likes: 28, description: "Mangues mûres, panier de 12 pièces." },
  { id: "p6", shopId: "s3", name: "Régime de plantains", price: 4200, category: "alim", condition: "Neuf", emoji: "🍌", bg: "linear-gradient(135deg,#5a8a5c,#e8b84a)", likes: 19, description: "Plantains frais du Sud, environ 8 kg." },
  { id: "p7", shopId: "s4", name: "Perruque brésilienne", price: 45000, category: "beaute", condition: "Neuf", emoji: "💇🏾‍♀️", bg: "linear-gradient(135deg,#4a2c2a,#c17c74)", likes: 210, description: "Cheveux 100% naturels, 20 pouces." },
  { id: "p8", shopId: "s5", name: "Masque Bamiléké", price: 55000, category: "artisanat", condition: "Neuf", emoji: "🎭", bg: "linear-gradient(135deg,#6b3a2a,#cd7f32)", likes: 47, description: "Sculpté à la main dans du bois d'iroko." },
  { id: "p9", shopId: "s6", name: "Fauteuil rotin", price: 78000, category: "maison", condition: "Occasion", emoji: "🪑", bg: "linear-gradient(135deg,#8b7355,#c9b99a)", likes: 33, description: "Fauteuil en rotin tressé, très bon état." },
  { id: "p10", shopId: "s1", name: "Sac en pagne", price: 12000, category: "mode", condition: "Neuf", emoji: "👜", bg: "linear-gradient(135deg,#c9a84c,#f0d78c)", likes: 71, description: "Sac artisanal doublé coton." },
];

export type FeedPost =
  | { kind: "product"; product: Product }
  | { kind: "post"; id: string; shopId: string; text: string; emoji: string; bg: string; likes: number };

export const feedPosts: FeedPost[] = [
  { kind: "product", product: products[0] },
  { kind: "post", id: "fp1", shopId: "s3", text: "Arrivage ce matin de Mokolo : mangues, ananas, papayes. Passez avant midi !", emoji: "🥭", bg: "linear-gradient(135deg,#e85d3a,#f7931e)", likes: 42 },
  { kind: "product", product: products[2] },
  { kind: "product", product: products[6] },
  { kind: "post", id: "fp2", shopId: "s1", text: "Nouvelle collection wax en préparation. Qui veut voir en avant-première ?", emoji: "🧵", bg: "linear-gradient(135deg,#c44569,#f8c8d8)", likes: 87 },
  { kind: "product", product: products[4] },
  { kind: "product", product: products[7] },
  { kind: "product", product: products[9] },
];

export type Review = {
  id: string;
  shopId: string;
  author: string;
  rating: number;
  text: string;
  date: string;
};

export const reviews: Review[] = [
  { id: "r1", shopId: "s1", author: "Marie N.", rating: 5, text: "Livraison rapide à Bastos, tissu magnifique !", date: "il y a 3 jours" },
  { id: "r2", shopId: "s1", author: "Junior E.", rating: 5, text: "Vendeuse très professionnelle, je recommande.", date: "il y a 1 semaine" },
  { id: "r3", shopId: "s1", author: "Claire M.", rating: 4, text: "Belles finitions, un peu long à recevoir.", date: "il y a 2 semaines" },
  { id: "r4", shopId: "s2", author: "Patrick K.", rating: 5, text: "iPhone impec, batterie ok comme annoncé.", date: "il y a 5 jours" },
  { id: "r5", shopId: "s2", author: "Sandra T.", rating: 4, text: "RAS pour les écouteurs.", date: "il y a 3 semaines" },
];

export type Conversation = {
  id: string;
  shopId: string;
  productId: string;
  lastMessage: string;
  time: string;
  unread: number;
  received: boolean;
  messages: { id: string; from: "me" | "them"; text?: string; kind?: "text" | "location"; time: string }[];
};

export const conversations: Conversation[] = [
  {
    id: "c1",
    shopId: "s1",
    productId: "p1",
    lastMessage: "Oui, elle est encore disponible !",
    time: "10:24",
    unread: 2,
    received: false,
    messages: [
      { id: "m1", from: "me", text: "Bonjour, la robe wax est encore dispo ?", time: "10:20", kind: "text" },
      { id: "m2", from: "them", text: "Bonjour ! Oui, elle est encore disponible !", time: "10:24", kind: "text" },
      { id: "m3", from: "them", text: "Vous êtes sur Yaoundé ?", time: "10:24", kind: "text" },
    ],
  },
  {
    id: "c2",
    shopId: "s2",
    productId: "p3",
    lastMessage: "Je peux vous livrer à Akwa demain.",
    time: "Hier",
    unread: 0,
    received: true,
    messages: [
      { id: "m1", from: "me", text: "L'iPhone est vraiment en bon état ?", time: "Hier 15:00", kind: "text" },
      { id: "m2", from: "them", text: "Oui, batterie 92%, garantie 6 mois.", time: "Hier 15:12", kind: "text" },
      { id: "m3", from: "them", text: "Je peux vous livrer à Akwa demain.", time: "Hier 15:14", kind: "text" },
    ],
  },
  {
    id: "c3",
    shopId: "s4",
    productId: "p7",
    lastMessage: "Merci pour votre commande !",
    time: "Lun",
    unread: 0,
    received: false,
    messages: [
      { id: "m1", from: "them", text: "Merci pour votre commande !", time: "Lun 09:00", kind: "text" },
    ],
  },
];

export const currentUser = {
  name: "Kwame",
  phone: "+237 6 55 44 33 22",
  city: "Yaoundé",
  hasShop: false,
  wishlist: ["p1", "p7"],
  following: ["s1", "s3"],
};

export function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}
