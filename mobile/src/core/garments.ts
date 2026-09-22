export type GarmentCategory = "top" | "bottom" | "shoes";

export type Garment = {
  id: string;
  category: GarmentCategory;
  name: string;
  brand: string;
  color: string;
  colorName: string;
  image: string;
  shape:
    | "shirt"
    | "tee"
    | "sweatshirt"
    | "jacket"
    | "jeans"
    | "trousers"
    | "shorts"
    | "casual"
    | "sport";
};

export const garments: Garment[] = [
  {
    id: "15970",
    category: "top",
    name: "Turtle Check Shirt",
    brand: "Turtle",
    color: "#233452",
    colorName: "Navy blue",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/98d4d8ff4f264ca568ba948a4524c92f_images.jpg",
    shape: "shirt",
  },
  {
    id: "53759",
    category: "top",
    name: "Essential Grey T-shirt",
    brand: "Puma",
    color: "#777878",
    colorName: "Grey",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/Puma-Men-Grey-T-shirt_42bb3c514744f090429ae8c6abc99abd_images.jpg",
    shape: "tee",
  },
  {
    id: "13089",
    category: "top",
    name: "LFC Auth Hoodie",
    brand: "Adidas",
    color: "#53575b",
    colorName: "Graphite",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/2fb677682f3db4d68d91735fbb248be9_images.jpg",
    shape: "sweatshirt",
  },
  {
    id: "6889",
    category: "top",
    name: "Stone Cream Jacket",
    brand: "Forever New",
    color: "#d0c5af",
    colorName: "Cream",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/015d1e76c5b83086a6225a862b80bf31_images.jpg",
    shape: "jacket",
  },
  {
    id: "39386",
    category: "bottom",
    name: "Party Blue Jeans",
    brand: "Peter England",
    color: "#37577b",
    colorName: "Denim blue",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/9518118a48a32e2fe37e6332b797849f_images.jpg",
    shape: "jeans",
  },
  {
    id: "10257",
    category: "bottom",
    name: "Solid Black Trousers",
    brand: "John Miller",
    color: "#242526",
    colorName: "Black",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/c89dcbbbb1808b968817653e03b8b2b5_images.jpg",
    shape: "trousers",
  },
  {
    id: "18005",
    category: "bottom",
    name: "Long Logo Bermuda",
    brand: "Puma",
    color: "#18191a",
    colorName: "Black",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/c2a91e5ecd0c4d503645435fd3089980_images.jpg",
    shape: "shorts",
  },
  {
    id: "9204",
    category: "shoes",
    name: "Future Cat Remix",
    brand: "Puma",
    color: "#1a1b1c",
    colorName: "Black",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/fc220b750764a2a093b791eaeb90fed5_images.jpg",
    shape: "casual",
  },
  {
    id: "3168",
    category: "shoes",
    name: "Incinerate MSL",
    brand: "Nike",
    color: "#e7e5df",
    colorName: "White",
    image:
      "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/97687ab5c5fb62fa367a5b5875d8835f_images.jpg",
    shape: "sport",
  },
];
