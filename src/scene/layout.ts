/** Physical layout of the store (metres, three.js Y-up). The entrance faces +Z at z = 18. */
export type DeptId = "technology" | "appliances" | "office" | "furniture";

export interface Shot { pos: [number, number, number]; target: [number, number, number]; fov?: number }

export interface Department {
  id: DeptId;
  name: string;
  /** dataset filter that defines the department */
  filter: { category: string; subCategories?: string[]; excludeSub?: string[] };
  note?: string;
  bounds: { x0: number; x1: number; z0: number; z1: number };
  accent: string;            // restrained identity colour (floor inlay + light strip)
  floor: "oak" | "terrazzo" | "concrete" | "walnut";
  shot: Shot;
  signPos: [number, number, number];
}

export const STORE = { x0: -30, x1: 30, z0: -24, z1: 18, height: 7.5 };

export const DEPARTMENTS: Department[] = [
  { id: "technology", name: "Technology", filter: { category: "Technology" },
    bounds: { x0: -27, x1: -8.5, z0: -5, z1: 8.5 }, accent: "#6EA8FF", floor: "terrazzo",
    shot: { pos: [-7.5, 4.4, 12.5], target: [-18.5, 0.9, 0.5], fov: 42 }, signPos: [-17.5, 4.6, 1.5] },
  { id: "appliances", name: "Appliances", filter: { category: "Office Supplies", subCategories: ["Appliances"] },
    note: "Appliances is a sub-category of Office Supplies in the dataset.",
    bounds: { x0: 8.5, x1: 27, z0: -5, z1: 8.5 }, accent: "#E8D9C0", floor: "concrete",
    shot: { pos: [7.5, 4.4, 12.5], target: [18.5, 0.9, 0.5], fov: 42 }, signPos: [17.5, 4.6, 1.5] },
  { id: "office", name: "Office Supplies", filter: { category: "Office Supplies", excludeSub: ["Appliances"] },
    note: "Shown without Appliances, which has its own department.",
    bounds: { x0: -27, x1: -8.5, z0: -22.5, z1: -8.5 }, accent: "#E7B46A", floor: "oak",
    shot: { pos: [-7.2, 5.2, -4.2], target: [-18.5, 0.7, -16], fov: 44 }, signPos: [-17.5, 4.6, -15.5] },
  { id: "furniture", name: "Furniture", filter: { category: "Furniture" },
    bounds: { x0: 8.5, x1: 27, z0: -22.5, z1: -8.5 }, accent: "#C98B5A", floor: "walnut",
    shot: { pos: [7.2, 5.2, -4.2], target: [18.5, 0.7, -16], fov: 44 }, signPos: [17.5, 4.6, -15.5] },
];
export const deptById = (id: DeptId) => DEPARTMENTS.find(d => d.id === id)!;

/** Sub-category bays: where each sub-category's stock physically lives, and how it is displayed. */
export type Display = "gondola" | "tables" | "floor" | "wall" | "showroom";
export interface Bay {
  sub: string; dept: DeptId; display: Display;
  /** gondola run: origin of the first module, axis 'z' (modules step along −z) */
  origin: [number, number, number]; maxModules: number;
  products: string[];        // model keys stocked in this bay
}
export const BAYS: Bay[] = [
  // Office Supplies: four gondola rows, two sub-categories per row
  { sub: "Binders",   dept: "office", display: "gondola", origin: [-24.8, 0, -10], maxModules: 4, products: ["prod_binder"] },
  { sub: "Paper",     dept: "office", display: "gondola", origin: [-24.8, 0, -16.2], maxModules: 4, products: ["prod_ream"] },
  { sub: "Storage",   dept: "office", display: "gondola", origin: [-21.3, 0, -10], maxModules: 4, products: ["prod_bin"] },
  { sub: "Art",       dept: "office", display: "gondola", origin: [-21.3, 0, -16.2], maxModules: 4, products: ["prod_tin", "prod_smallbox"] },
  { sub: "Envelopes", dept: "office", display: "gondola", origin: [-17.8, 0, -10], maxModules: 4, products: ["prod_smallbox"] },
  { sub: "Labels",    dept: "office", display: "gondola", origin: [-17.8, 0, -16.2], maxModules: 4, products: ["prod_smallbox"] },
  { sub: "Fasteners", dept: "office", display: "gondola", origin: [-14.3, 0, -10], maxModules: 4, products: ["prod_smallbox", "prod_tin"] },
  { sub: "Supplies",  dept: "office", display: "gondola", origin: [-14.3, 0, -16.2], maxModules: 4, products: ["prod_carton"] },
  // Technology
  { sub: "Accessories", dept: "technology", display: "gondola", origin: [-25, 0, 7], maxModules: 5, products: ["tech_headphones", "prod_carton", "tech_keyboard", "prod_carton"] },
  { sub: "Machines",    dept: "technology", display: "gondola", origin: [-21.5, 0, 7], maxModules: 5, products: ["tech_printer", "prod_carton"] },
  { sub: "Phones",      dept: "technology", display: "tables", origin: [-16, 0, 5.5], maxModules: 4, products: ["tech_phone", "tech_laptop"] },
  { sub: "Copiers",     dept: "technology", display: "floor", origin: [-11.2, 0, 6.5], maxModules: 6, products: ["tech_copier"] },
  // Appliances
  { sub: "Appliances", dept: "appliances", display: "wall", origin: [25.6, 0, 7], maxModules: 8, products: ["app_fridge", "app_coffee", "app_toaster", "vintage_microwave", "vintage_electric_kettle"] },
  // Furniture showroom zones
  { sub: "Chairs",      dept: "furniture", display: "showroom", origin: [12, 0, -11], maxModules: 12, products: ["furn_chair", "modern_arm_chair_01", "mid_century_lounge_chair", "dining_chair_02", "ArmChair_01", "bar_chair_round_01"] },
  { sub: "Tables",      dept: "furniture", display: "showroom", origin: [21, 0, -11], maxModules: 8, products: ["furn_table", "round_wooden_table_01", "modern_coffee_table_02", "metal_office_desk", "coffee_table_round_01", "side_table_01"] },
  { sub: "Bookcases",   dept: "furniture", display: "showroom", origin: [26, 0, -21], maxModules: 7, products: ["furn_bookcase", "modern_wooden_cabinet", "drawer_cabinet"] },
  { sub: "Furnishings", dept: "furniture", display: "showroom", origin: [13, 0, -19.5], maxModules: 10, products: ["sofa_02", "modern_coffee_table_01", "potted_plant_01", "potted_plant_02", "desk_lamp_arm_01", "wall_clock", "wicker_basket_01", "potted_plant_04", "sofa_03"] },
];

/** Checkout lanes; the three right-hand lanes double as the customer-segment lanes. */
export const CHECKOUTS = [-24.5, -20, -15.5, 15.5, 20, 24.5].map((x, i) => ({ x, z: 12.6, segment: i >= 3 ? (["Consumer", "Corporate", "Home Office"] as const)[i - 3] : null }));

export const ATRIUM = { x: 0, z: -15.5, w: 11, d: 8 };   // the insights table (3D map + product plinth)

export const SHOTS: Record<string, Shot> = {
  exteriorFar: { pos: [0, 2.6, 78], target: [0, 4.6, 18], fov: 34 },
  exteriorNear: { pos: [0, 2.0, 30], target: [0, 2.6, 12], fov: 40 },
  threshold: { pos: [0, 1.72, 16.6], target: [0, 1.8, 2], fov: 50 },
  inside: { pos: [0, 2.2, 10], target: [0, 1.6, -6], fov: 52 },
  reveal: { pos: [0, 6.1, 14.2], target: [0, 0.6, -10], fov: 52 },
  overview: { pos: [0, 21, 30], target: [0, 0, -4], fov: 42 },
  kpi: { pos: [0, 14.5, 25], target: [0, 1, -5], fov: 44 },
  atrium: { pos: [0, 7.2, -3.5], target: [0, 0.6, -16], fov: 46 },
  map: { pos: [0, 9.5, -6.5], target: [0, 0.8, -16.2], fov: 42 },
  plinth: { pos: [3.1, 2.35, -5.4], target: [0, 1.25, -10.3], fov: 40 },
  customers: { pos: [5, 3.4, 5.5], target: [19.5, 0.9, 13], fov: 46 },
  salesStart: { pos: [0, 2.6, 15], target: [0, 1.6, 0], fov: 50 },
};
export const deptShot = (id: DeptId) => deptById(id).shot;

/** Walkable routes for the shoppers (closed loops on the floor). */
export const ROUTES: [number, number][][] = [
  [[-3, 14], [-3, -8], [-7, -9.5], [-7, -3], [-12, 9.5], [-3, 14]],
  [[3, 14], [3, -8], [7, -9.5], [7.5, -3], [12, 9.5], [3, 14]],
  [[-2, 9], [-10, -7.5], [-26, -7.6], [-12, -7], [-2, 9]],
  [[2, 9], [10, -7.5], [26, -7.6], [12, -7], [2, 9]],
  [[-5, 10.5], [-27, 10.2], [-5, 10.8]],
  [[5, 10.5], [27, 10.2], [5, 10.8]],
];
