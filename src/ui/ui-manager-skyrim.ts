// Skyrim-style UI constants
export const SKYRIM_COLORS = {
  GOLD: "#D4AF37",
  DARK_BROWN: "rgba(20, 15, 10, 0.95)",
  BROWN: "#8B7355",
  VERY_DARK: "rgba(20, 15, 10, 0.9)",
  HEALTH_RED: "#DC143C",
  MAGICKA_BLUE: "#4169E1",
  STAMINA_GREEN: "#228B22",
  LIGHT_BROWN: "rgba(100, 80, 60, 0.8)",
  DARK_INTERIOR: "rgba(30, 25, 20, 0.8)",
};

export const SKYRIM_FONTS = {
  TITLE_SIZE: 32,
  LARGE_SIZE: 22,
  NORMAL_SIZE: 18,
  SMALL_SIZE: 14,
  TINY_SIZE: 11,
};

/**
 * Utility function to create Skyrim-style styled text blocks
 */
export function createSkyrimText(
  text: string,
  fontSize: number,
  color: string = SKYRIM_COLORS.GOLD,
  bold: boolean = false
) {
  const textBlock = new (require("@babylonjs/gui/2D").TextBlock)();
  textBlock.text = text;
  textBlock.color = color;
  textBlock.fontSize = fontSize;
  if (bold) textBlock.fontStyle = "bold";
  textBlock.shadowBlur = Math.max(1, Math.floor(fontSize / 12));
  textBlock.shadowColor = "black";
  return textBlock;
}

/**
 * Utility function to create Skyrim-style buttons
 */
export function createSkyrimButton(
  text: string,
  width: string = "90%",
  height: string = "50px"
) {
  const Button = require("@babylonjs/gui/2D").Button;
  const button = Button.CreateSimpleButton("btn_" + text, text);
  button.width = width;
  button.height = height;
  button.color = SKYRIM_COLORS.BROWN;
  button.cornerRadius = 0;
  button.background = SKYRIM_COLORS.DARK_INTERIOR;
  button.paddingBottom = "10px";
  button.paddingTop = "5px";
  button.hoverCursor = "pointer";
  button.thickness = 2;
  button.fontSize = SKYRIM_FONTS.NORMAL_SIZE;
  button.fontStyle = "bold";

  // Style text
  if (button.children && button.children[0]) {
    const textBlock = button.children[0];
    textBlock.color = SKYRIM_COLORS.GOLD;
    textBlock.fontSize = SKYRIM_FONTS.NORMAL_SIZE;
  }

  button.onPointerEnterObservable.add(() => {
    button.background = SKYRIM_COLORS.LIGHT_BROWN;
    button.color = SKYRIM_COLORS.GOLD;
  });
  button.onPointerOutObservable.add(() => {
    button.background = SKYRIM_COLORS.DARK_INTERIOR;
    button.color = SKYRIM_COLORS.BROWN;
  });

  return button;
}
