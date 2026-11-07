// Grundriss des Gebäudes. Eine Zelle = CS Meter.
// #  Wand            W  (automatisch) Fenster in Außenwand
// D  Tür             X  verschlossene Ausgangstür
// o  Büro            c  Flur
// s  Lager/Archiv    k  Keller
// l  Eingangshalle   P  Startpunkt (Halle)
// T  Schreibtisch    S  Regal   B  Schrank   C  Kisten   O  Pfeiler
// H  Versteck (Schrank, Spind oder Mauerspalt – je nach Raum)
export const MAP = [
  "##########################################",
  "#ooooooooH#ooooooooo#ooooooooH#sssssssssH#",
  "#oTToooTTo#oTTooooTo#ooooooooo#sSSssSSsss#",
  "#ooooooooo#ooooooooo#ooTTTTToo#ssssssssCs#",
  "#oooooBooo#ooooooooo#ooooooooo#sSSssSSsss#",
  "#ooooooooo#HooooBooo#ooooooooo#ssCsssssss#",
  "#####D#########D#########D##########D#####",
  "#cccccccccccccccccccccccccccccccccccccccc#",
  "#cccccccccccccccccccccccccccccccccccccccc#",
  "####D########D#######cccc######D#######cc#",
  "#Hkkkkkkk#oooooooo#lllllllH#ssssssssss#cc#",
  "#kkkkkkkk#oTTooTTo#llllllll#sSSsSSsSSs#cc#",
  "#kkkkkkkk#ooooooooDllllllll#ssssssssss#cc#",
  "#kkkkkkkk#oooBoooo#llllllllDssssssssss#cc#",
  "#kkkkkkkk#oooooooo#llllllll#sSSsSSsSSsDcc#",
  "#kkCkkkkk#ooTTTooo#llllllll#ssssssssss#cc#",
  "#kkkkkkkk#oooooooH#llllllll#HsCsssssCs#cc#",
  "###kkk#############llllllll######D#####cc#",
  "#kkkkkkkkkkkkkkkH#Hlllllllll#sssssssss#cc#",
  "#kkOkkkkOkkkkOkkk#llllllllll#sSSsSSsSs#cc#",
  "#kkkkkkkkkkkkkkCk#llllllllllDsssssssss#cc#",
  "#kkCCkkkkkkkkkkkk#llllllllll#sssssssss#cc#",
  "#kkkkkkkkkkkkkkkkDllllllllll#sSSsSSsSs#cc#",
  "#kkOkkkkOkkkkOkkk#llllllllll#sssssssss#cc#",
  "#kkkkkkkkkkkkkkkk#llllPlllll#ssssCssssDcc#",
  "#kkkkCkkkkkkkkCkk#llllllllll#sssssssss#cc#",
  "#Hkkkkkkkkkkkkkkk#lllllllllH#ssssssssH#cc#",
  "######################X###################",
];

export const ZONE_NAMES = {
  o: 'Büro', c: 'Flur', s: 'Lager', k: 'Keller', l: 'Eingangshalle',
};
