const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData = [
  {
    "sku_code": "TWF01",
    "name": "Plastic Headlight cap",
    "buying_price": 80.0,
    "selling_price": 200.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF02",
    "name": "Nickel headlight cap",
    "buying_price": 200.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF03",
    "name": "headlight viser nickle kura",
    "buying_price": 425.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF04",
    "name": "Titanium kura",
    "buying_price": 500.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF05",
    "name": "Plastic Black Doom",
    "buying_price": 175.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF06",
    "name": "Color Painted Doom",
    "buying_price": 500.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF07",
    "name": "Nickel headlight doom",
    "buying_price": 1860.0,
    "selling_price": 2800.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF08",
    "name": "Headlight Black ring",
    "buying_price": 450.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF09",
    "name": "Headlight Painted White ring",
    "buying_price": 550.0,
    "selling_price": 1100.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF10",
    "name": "Headligiht Doom Full Set( Nickle Doom + Nickle RIng + Nickle Cap + Nickle Kura )",
    "buying_price": 3300.0,
    "selling_price": 5600.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF11",
    "name": "Headlight nikel ring",
    "buying_price": 810.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF12",
    "name": "Front mud guard nikel wata (Nickle Otunna)",
    "buying_price": 3100.0,
    "selling_price": 3750.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF13",
    "name": "Country Flag",
    "buying_price": 80.0,
    "selling_price": 200.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF14",
    "name": "issaraha nahaye nickle kura",
    "buying_price": 700.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF15",
    "name": "5 Port Horn Guard",
    "buying_price": 750.0,
    "selling_price": 1100.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF16",
    "name": "3 Port Horn Guard",
    "buying_price": 850.0,
    "selling_price": 1350.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF17",
    "name": "viper rubber",
    "buying_price": 150.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF18",
    "name": "Viper hand",
    "buying_price": 225.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF19",
    "name": "Viper aid",
    "buying_price": 300.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF20",
    "name": "viper  Normal",
    "buying_price": 400.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF21",
    "name": "Viper Blade Normal Kaha Label",
    "buying_price": 750.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF22",
    "name": "viper Japan Blade",
    "buying_price": 425.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF23",
    "name": "Viper Normal + Rubber + Blade",
    "buying_price": 700.0,
    "selling_price": 1350.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF24",
    "name": "Viper Hoda 1 + Rubber + Japan Blade",
    "buying_price": 1150.0,
    "selling_price": 1850.0,
    "stock_quantity": 30,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF25",
    "name": "4 Stock Viper Normal",
    "buying_price": 495.0,
    "selling_price": 980.0,
    "stock_quantity": 10,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF26",
    "name": "4 Stock Viper Modified",
    "buying_price": 900.0,
    "selling_price": 1550.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF27",
    "name": "4-Stock Hybrid NGG Hoda Viper",
    "buying_price": 700.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF28",
    "name": "4-stock China Viper Normal",
    "buying_price": 350.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF29",
    "name": "side mirror",
    "buying_price": 420.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF30",
    "name": "Side Mirror  Nickle Arm",
    "buying_price": 260.0,
    "selling_price": 530.0,
    "stock_quantity": 19,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF31",
    "name": "Side Mirror White Color Arm",
    "buying_price": 230.0,
    "selling_price": 480.0,
    "stock_quantity": 9,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF32",
    "name": "3 Port Mirror Pair",
    "buying_price": 900.0,
    "selling_price": 1530.0,
    "stock_quantity": 6,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF33",
    "name": "Green Glass Lock Cable Q1",
    "buying_price": 140.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF34",
    "name": "Green Glass Lock Cable Q2",
    "buying_price": 125.0,
    "selling_price": 200.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF35",
    "name": "Green Glass Lock Cable Q3",
    "buying_price": 55.0,
    "selling_price": 150.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF36",
    "name": "Luwis Kodi Wellampiti",
    "buying_price": 195.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF37",
    "name": "Luwis Kodi Color Printed",
    "buying_price": 195.0,
    "selling_price": 300.0,
    "stock_quantity": 40,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF38",
    "name": "Color Luminas Kodi",
    "buying_price": 130.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF39",
    "name": "FM antenna",
    "buying_price": 650.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF40",
    "name": "loku star bobin",
    "buying_price": 750.0,
    "selling_price": 1100.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF41",
    "name": "Y Number Front Signal Light Pair",
    "buying_price": 1450.0,
    "selling_price": 2250.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF42",
    "name": "2 - Stock Front Signal Light Pair",
    "buying_price": 1350.0,
    "selling_price": 1850.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF43",
    "name": "front glass white antenna",
    "buying_price": 275.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF44",
    "name": "modify bobin (loku)",
    "buying_price": 1200.0,
    "selling_price": 1600.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF45",
    "name": "modify front loku bobin",
    "buying_price": 700.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF46",
    "name": "modify front loku bobin+ batch",
    "buying_price": 900.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF47",
    "name": "taxi light",
    "buying_price": 185.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF48",
    "name": "taxi light 2( two color)",
    "buying_price": 380.0,
    "selling_price": 680.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF49",
    "name": "kuru 2 animal antenna",
    "buying_price": 400.0,
    "selling_price": 650.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF50",
    "name": "Loku Jaguar single",
    "buying_price": 180.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF51",
    "name": "Podi Jaguar pair",
    "buying_price": 280.0,
    "selling_price": 480.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF52",
    "name": "Podi Jaguar Single",
    "buying_price": 140.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF53",
    "name": "Plastic Fork Cover",
    "buying_price": 90.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF54",
    "name": "Side Mirror Nickle Nob",
    "buying_price": 350.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF55",
    "name": "Mune Joint Beading  Rubber",
    "buying_price": 700.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF56",
    "name": "Mune Joint Beading Nickel rola",
    "buying_price": 7500.0,
    "selling_price": 9850.0,
    "stock_quantity": 3,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF57",
    "name": "FL headlight nikel pair",
    "buying_price": 1550.0,
    "selling_price": 2380.0,
    "stock_quantity": 2,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF58",
    "name": "nikel mirror cover",
    "buying_price": 900.0,
    "selling_price": 1530.0,
    "stock_quantity": 2,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF59",
    "name": "Y signal light nikel",
    "buying_price": 675.0,
    "selling_price": 1080.0,
    "stock_quantity": 2,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF60",
    "name": "Y headlight nikel cover",
    "buying_price": 875.0,
    "selling_price": 1480.0,
    "stock_quantity": 1,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF61",
    "name": "2 Stock Body Kit",
    "buying_price": 1400.0,
    "selling_price": 2380.0,
    "stock_quantity": 4,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF62",
    "name": "Towing Hook",
    "buying_price": 395.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL01",
    "name": "BOSS HeadLight 1",
    "buying_price": 2150.0,
    "selling_price": 3000.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL02",
    "name": "BOSS Head Light 2",
    "buying_price": 2100.0,
    "selling_price": 2650.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL03",
    "name": "Devil Head Light",
    "buying_price": 2500.0,
    "selling_price": 3200.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL04",
    "name": "X Head Light",
    "buying_price": 2250.0,
    "selling_price": 3380.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL05",
    "name": "V Head Light",
    "buying_price": 2250.0,
    "selling_price": 3380.0,
    "stock_quantity": 19,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL06",
    "name": "Projector Head Light",
    "buying_price": 2450.0,
    "selling_price": 2950.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL07",
    "name": "Two Ring Head Light",
    "buying_price": 1850.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL08",
    "name": "12 - LED Head Light",
    "buying_price": 575.0,
    "selling_price": 980.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL09",
    "name": "6 - LED Head Light",
    "buying_price": 500.0,
    "selling_price": 930.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL10",
    "name": "Driver Mini Light Loku",
    "buying_price": 180.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL11",
    "name": "Driver Mini Light Loku",
    "buying_price": 150.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL12",
    "name": "Headlight Pin Shocket",
    "buying_price": 85.0,
    "selling_price": 200.0,
    "stock_quantity": 19,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL01",
    "name": "U7 Mini Fog Light",
    "buying_price": 650.0,
    "selling_price": 1080.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL02",
    "name": "U7 Big Fog Light",
    "buying_price": 1100.0,
    "selling_price": 1750.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL03",
    "name": "2 pcs fog light head kali 2",
    "buying_price": 650.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL04",
    "name": "podi fog light",
    "buying_price": 220.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL05",
    "name": "3-Ring Bassa Fog Light",
    "buying_price": 1500.0,
    "selling_price": 2380.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL06",
    "name": "21 LED Fog Light",
    "buying_price": 450.0,
    "selling_price": 880.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL07",
    "name": "mini gun fog light",
    "buying_price": 250.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWL01",
    "name": "3-Code Light Pati",
    "buying_price": 150.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWL02",
    "name": "front tent side light",
    "buying_price": 500.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWL03",
    "name": "rear light pati",
    "buying_price": 850.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO01",
    "name": "3-Code Light Pati",
    "buying_price": 150.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO02",
    "name": "front tent side light",
    "buying_price": 500.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO03",
    "name": "rear light pati",
    "buying_price": 850.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO04",
    "name": "Driver Seat Light Podi",
    "buying_price": 150.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO05",
    "name": "Driver Seat Light Loku",
    "buying_price": 200.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO06",
    "name": "Spoilor Light",
    "buying_price": 1200.0,
    "selling_price": 2480.0,
    "stock_quantity": 4,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO07",
    "name": "2-Stock Break Light Pair ( Normal)",
    "buying_price": 1450.0,
    "selling_price": 2000.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO08",
    "name": "2-Stock Break Light Pair ( Sapaththu)",
    "buying_price": 1450.0,
    "selling_price": 2000.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLO09",
    "name": "White Light Circuit",
    "buying_price": 95.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Other Lights",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS01",
    "name": "wellampiti loku Sun visor set",
    "buying_price": 3900.0,
    "selling_price": 4800.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS02",
    "name": "Side wellampiti viser set",
    "buying_price": 1700.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS03",
    "name": "wellampiti loku Front Viser",
    "buying_price": 1700.0,
    "selling_price": 2300.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS04",
    "name": "wellampiti Hulan Kaulu Pair",
    "buying_price": 500.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS05",
    "name": "Ambatale Side Viser(L)",
    "buying_price": 2800.0,
    "selling_price": 3500.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS06",
    "name": "Abathale Full Set",
    "buying_price": 5600.0,
    "selling_price": 6500.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWVS07",
    "name": "Sun viser bracket",
    "buying_price": 70.0,
    "selling_price": 150.0,
    "stock_quantity": 20,
    "sub_category": "Sunvisor",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS01",
    "name": "Door guard",
    "buying_price": 250.0,
    "selling_price": 480.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS02",
    "name": "tent handle",
    "buying_price": 350.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS03",
    "name": "Iri pati",
    "buying_price": 400.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS04",
    "name": "Side Embose Two Layer Light Door",
    "buying_price": 4500.0,
    "selling_price": 6880.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS05",
    "name": "Side black door",
    "buying_price": 350.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS06",
    "name": "Nickle Side Door Bar",
    "buying_price": 950.0,
    "selling_price": 1930.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS07",
    "name": "Swim Arm Nicle Round Cone",
    "buying_price": 1000.0,
    "selling_price": 1600.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS08",
    "name": "BMW / Audi Batch Swim Arm Nickle",
    "buying_price": 1200.0,
    "selling_price": 1600.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS09",
    "name": "swim arm nikel (menik gala)",
    "buying_price": 650.0,
    "selling_price": 1150.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS10",
    "name": "swim arm nikel badge nikel",
    "buying_price": 850.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS11",
    "name": "swing arm plastic ball",
    "buying_price": 300.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS12",
    "name": "Nuwara Bata Set",
    "buying_price": 7400.0,
    "selling_price": 8500.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS13",
    "name": "Wellampiti Bata Set",
    "buying_price": 5800.0,
    "selling_price": 7000.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS14",
    "name": "mud guard light pair",
    "buying_price": 650.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWS15",
    "name": "Mal bobin",
    "buying_price": 650.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Side",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB01",
    "name": "mada cover with Kurulla Sticker",
    "buying_price": 450.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB02",
    "name": "Paint mada cover color",
    "buying_price": 600.0,
    "selling_price": 900.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB03",
    "name": "Paint mada cover white",
    "buying_price": 500.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB04",
    "name": "Plain mada cover Pair",
    "buying_price": 200.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB05",
    "name": "Home Modified Plain mada cover",
    "buying_price": 360.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB06",
    "name": "Home Modified Color mada cover",
    "buying_price": 750.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB07",
    "name": "Plain Single Black Mud Carpet",
    "buying_price": 100.0,
    "selling_price": 200.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB08",
    "name": "Mud Cover Bracket",
    "buying_price": 120.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB09",
    "name": "park light cup black",
    "buying_price": 450.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB10",
    "name": "Back window white antenna Good",
    "buying_price": 175.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB11",
    "name": "Back window white antenna Loacal",
    "buying_price": 80.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB12",
    "name": "Long Black Antana",
    "buying_price": 180.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB13",
    "name": "2-Stock silence beat bata",
    "buying_price": 245.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB14",
    "name": "4-Stock silence beat bata",
    "buying_price": 250.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB15",
    "name": "Sedawatta Agal 3/4 Beat",
    "buying_price": 500.0,
    "selling_price": 900.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB16",
    "name": "Abathale Agala Beat",
    "buying_price": 600.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB17",
    "name": "Dummy Towing Hook",
    "buying_price": 325.0,
    "selling_price": 680.0,
    "stock_quantity": 6,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB18",
    "name": "redi patiya(OMP)",
    "buying_price": 500.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB19",
    "name": "Buffer pati Normal",
    "buying_price": 380.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB20",
    "name": "Buffer pati Original",
    "buying_price": 500.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB21",
    "name": "2 stock buffer(kulla)",
    "buying_price": 1300.0,
    "selling_price": 1850.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB22",
    "name": "2 stock Risara buffer(kulla)",
    "buying_price": 2500.0,
    "selling_price": 3530.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB23",
    "name": "4 stock Kulla (Buffer)",
    "buying_price": 1400.0,
    "selling_price": 1950.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB24",
    "name": "Sedawatta Kulla",
    "buying_price": 5800.0,
    "selling_price": 7300.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB25",
    "name": "kulla Tail Light Normal(Red Kotu Pair)",
    "buying_price": 120.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB26",
    "name": "kulla Tail Light LED(Red Kotu Pair)",
    "buying_price": 750.0,
    "selling_price": 1300.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB27",
    "name": "break/signal/park light bulb",
    "buying_price": 45.0,
    "selling_price": 100.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB28",
    "name": "modify signal light cup",
    "buying_price": 700.0,
    "selling_price": 900.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB29",
    "name": "Door nob Plastic",
    "buying_price": 15.0,
    "selling_price": 30.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB30",
    "name": "Nikel podi door ball",
    "buying_price": 225.0,
    "selling_price": 380.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB31",
    "name": "Nickle back door nob Red/Blue Gem",
    "buying_price": 260.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB32",
    "name": "reverse fogg light",
    "buying_price": 1400.0,
    "selling_price": 1650.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB33",
    "name": "door ball ( Nickle Podi Bola 2 )",
    "buying_price": 245.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB34",
    "name": "Original Door Nut Pair",
    "buying_price": 300.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB35",
    "name": "Normal Break light nikel",
    "buying_price": 600.0,
    "selling_price": 1180.0,
    "stock_quantity": 1,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB36",
    "name": "sapattu Break light nikel",
    "buying_price": 700.0,
    "selling_price": 1280.0,
    "stock_quantity": 2,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWB37",
    "name": "Nickle Mal Antana",
    "buying_price": 1500.0,
    "selling_price": 2630.0,
    "stock_quantity": 2,
    "sub_category": "Back",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI01",
    "name": "steering wheel cover",
    "buying_price": 425.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI02",
    "name": "Driving Seat Mirror Plastic",
    "buying_price": 350.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI03",
    "name": "Driving Seat Yakada Mirror Hoda",
    "buying_price": 600.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI04",
    "name": "panoramic inner mirror",
    "buying_price": 650.0,
    "selling_price": 1330.0,
    "stock_quantity": 4,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI05",
    "name": "2-Stock front rubber carpet",
    "buying_price": 775.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI06",
    "name": "2-Stock rear rubber carpet",
    "buying_price": 800.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI07",
    "name": "4-Stock front rubber carpet",
    "buying_price": 800.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI08",
    "name": "4-Stock rear rubber carpet",
    "buying_price": 800.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI09",
    "name": "wahana colour carpet back1 +front 1",
    "buying_price": 1950.0,
    "selling_price": 2200.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI10",
    "name": "Rider Grip Green Box",
    "buying_price": 375.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI11",
    "name": "One Layer Break Paddle Light Pad",
    "buying_price": 350.0,
    "selling_price": 650.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI12",
    "name": "Two Layer Break Paddle Light Pad",
    "buying_price": 650.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI13",
    "name": "Plastic Break Paddle",
    "buying_price": 180.0,
    "selling_price": 430.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI14",
    "name": "AC bata punch",
    "buying_price": 1225.0,
    "selling_price": 1880.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI15",
    "name": "Midi pokura (grapes) XL",
    "buying_price": 1200.0,
    "selling_price": 1950.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI16",
    "name": "midi pokura (grapes) L",
    "buying_price": 550.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI17",
    "name": "midi pokura (grapes) Podi",
    "buying_price": 370.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI18",
    "name": "Battery  Carpet",
    "buying_price": 1500.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI19",
    "name": "Kambi phone holder",
    "buying_price": 325.0,
    "selling_price": 575.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI20",
    "name": "steering ball",
    "buying_price": 325.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI21",
    "name": "eye light",
    "buying_price": 1000.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI22",
    "name": "Devi Rupa Normal",
    "buying_price": 800.0,
    "selling_price": 1300.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI23",
    "name": "Devi Rupa Color",
    "buying_price": 880.0,
    "selling_price": 1380.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI24",
    "name": "air freshner pocket",
    "buying_price": 250.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI25",
    "name": "Light Charging Cable",
    "buying_price": 300.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI26",
    "name": "5 Way Switch Set",
    "buying_price": 550.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI27",
    "name": "hybrid battery 4",
    "buying_price": 2200.0,
    "selling_price": 3000.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI28",
    "name": "ENGG Battery Terminator  Lock",
    "buying_price": 250.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI29",
    "name": "red on/off switch",
    "buying_price": 65.0,
    "selling_price": 150.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI30",
    "name": "Kebi Mudi Set",
    "buying_price": 400.0,
    "selling_price": 680.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI31",
    "name": "Break Oil Bottle",
    "buying_price": 300.0,
    "selling_price": 630.0,
    "stock_quantity": 20,
    "sub_category": "Inside",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW01",
    "name": "Keta Alloywheel",
    "buying_price": 12000.0,
    "selling_price": 13800.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW02",
    "name": "Football Alloywheel",
    "buying_price": 13500.0,
    "selling_price": 14700.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW03",
    "name": "Fan Alloywheel",
    "buying_price": 13000.0,
    "selling_price": 14300.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW04",
    "name": "Kuru Alloywheel",
    "buying_price": 13000.0,
    "selling_price": 14300.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW05",
    "name": "Other Design Alloywheels",
    "buying_price": 13250.0,
    "selling_price": 14300.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW06",
    "name": "Rotert Rim Cup",
    "buying_price": 850.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW07",
    "name": "Dehivala Rim Cup",
    "buying_price": 2000.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW08",
    "name": "alloy wheel Center Wheel Cup",
    "buying_price": 600.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW09",
    "name": "alloy wheel Center Wheel Cup With Batch",
    "buying_price": 850.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW10",
    "name": "loku modify tyre",
    "buying_price": 8500.0,
    "selling_price": 10000.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW11",
    "name": "Alloy wheel Ena (TVS)",
    "buying_price": 135.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW12",
    "name": "Alloy Wheel Nickle Ena Set Box",
    "buying_price": 1300.0,
    "selling_price": 1650.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW13",
    "name": "Nickel Rim Cup",
    "buying_price": 1200.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW14",
    "name": "Rim Cup",
    "buying_price": 425.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW15",
    "name": "Boku Rim Rear Pair",
    "buying_price": 3100.0,
    "selling_price": 4980.0,
    "stock_quantity": 3,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW16",
    "name": "Boku Rim Font",
    "buying_price": 1450.0,
    "selling_price": 2480.0,
    "stock_quantity": 2,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW17",
    "name": "Vezal Rim Cup",
    "buying_price": 400.0,
    "selling_price": 730.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW18",
    "name": "Tricycle Rim Cup",
    "buying_price": 750.0,
    "selling_price": 1480.0,
    "stock_quantity": 20,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWAW19",
    "name": "Mathara rim cup",
    "buying_price": 1700.0,
    "selling_price": 2900.0,
    "stock_quantity": 2,
    "sub_category": "Wheels",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO01",
    "name": "Dam Kotu Beading Roll",
    "buying_price": 475.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO02",
    "name": "Car beading roll",
    "buying_price": 325.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO03",
    "name": "hood rack",
    "buying_price": 14700.0,
    "selling_price": 17000.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO04",
    "name": "moone joint bracket",
    "buying_price": 300.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO05",
    "name": "loku rawum bobin",
    "buying_price": 650.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO06",
    "name": "Tent Wate Color Mini Olu Set",
    "buying_price": 700.0,
    "selling_price": 1230.0,
    "stock_quantity": 15,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO07",
    "name": "Tent Wate Mini Olu Set",
    "buying_price": 275.0,
    "selling_price": 650.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO08",
    "name": "tent wate bassa set",
    "buying_price": 1400.0,
    "selling_price": 2000.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO09",
    "name": "fuse box",
    "buying_price": 90.0,
    "selling_price": 150.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO10",
    "name": "beading clip set",
    "buying_price": 250.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO11",
    "name": "Japan Number Plate Podi",
    "buying_price": 350.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO12",
    "name": "Japan Number Plate Loku",
    "buying_price": 450.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO13",
    "name": "Wellampiti RC Rectifier",
    "buying_price": 475.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO14",
    "name": "2-Stock Rear Razer Set",
    "buying_price": 635.0,
    "selling_price": 900.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO15",
    "name": "Read Valve",
    "buying_price": 1600.0,
    "selling_price": 2350.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO16",
    "name": "3 - wheel Rain Cover",
    "buying_price": 1800.0,
    "selling_price": 2700.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO17",
    "name": "Bike Rain Cover",
    "buying_price": 950.0,
    "selling_price": 1800.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO18",
    "name": "Balck Front Number Plate Bracket",
    "buying_price": 350.0,
    "selling_price": 780.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO19",
    "name": "Nickle Front Number Plate Bracket",
    "buying_price": 750.0,
    "selling_price": 1380.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO20",
    "name": "Nickle Rear Number Plate Bracket",
    "buying_price": 475.0,
    "selling_price": 880.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWO21",
    "name": "Plastic Bottle Case",
    "buying_price": 75.0,
    "selling_price": 430.0,
    "stock_quantity": 20,
    "sub_category": "Other",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS01",
    "name": "Japan Sticker Set Card",
    "buying_price": 195.0,
    "selling_price": 650.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS02",
    "name": "banda sticker",
    "buying_price": 350.0,
    "selling_price": 950.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS03",
    "name": "3 Port Front Park Light Pair",
    "buying_price": 1300.0,
    "selling_price": 1900.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS04",
    "name": "3 Port Break Light Pair",
    "buying_price": 1300.0,
    "selling_price": 1900.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS05",
    "name": "5 Port / 3 Port Full Stiker Set",
    "buying_price": 1300.0,
    "selling_price": 1600.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS06",
    "name": "G H Num Full Sticker Set",
    "buying_price": 1050.0,
    "selling_price": 1450.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS07",
    "name": "Normal Q,J Sticker Set",
    "buying_price": 900.0,
    "selling_price": 1350.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSS08",
    "name": "No Smoking Sticker",
    "buying_price": 35.0,
    "selling_price": 120.0,
    "stock_quantity": 20,
    "sub_category": "Sticker",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL01",
    "name": "Wellampiti Full Light Set",
    "buying_price": 5000.0,
    "selling_price": 6750.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL02",
    "name": "Wellampiti Buffer Light",
    "buying_price": 600.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL03",
    "name": "Wellampiti Bada Light Pair",
    "buying_price": 800.0,
    "selling_price": 1400.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL04",
    "name": "Wellampiti Light Polu",
    "buying_price": 1800.0,
    "selling_price": 2200.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL05",
    "name": "Wellampiti Mud Cover Light Pair",
    "buying_price": 500.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL06",
    "name": "Wellampiti Back Window Light Pair",
    "buying_price": 800.0,
    "selling_price": 1400.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL07",
    "name": "Number 1 Quality Back Window light",
    "buying_price": 1600.0,
    "selling_price": 2480.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL08",
    "name": "Wellampiti Jet Light",
    "buying_price": 425.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL09",
    "name": "Normal light polu",
    "buying_price": 380.0,
    "selling_price": 630.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL10",
    "name": "White Fog/Vip Light",
    "buying_price": 800.0,
    "selling_price": 1300.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL11",
    "name": "Bada Light Nickle Guard",
    "buying_price": 400.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT01",
    "name": "Limited Edition Batch",
    "buying_price": 120.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT02",
    "name": "Cobra Batch",
    "buying_price": 275.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT03",
    "name": "Vip Motors Batch Gold",
    "buying_price": 225.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT04",
    "name": "Vip Motors Batch Blue",
    "buying_price": 325.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT05",
    "name": "Mini Batch",
    "buying_price": 275.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT06",
    "name": "Peugeot Batch",
    "buying_price": 300.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT07",
    "name": "Crown Steel Batch",
    "buying_price": 300.0,
    "selling_price": 650.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT08",
    "name": "Round Monster Steel Batch",
    "buying_price": 275.0,
    "selling_price": 375.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT09",
    "name": "Gold/Silver Steel Batch",
    "buying_price": 300.0,
    "selling_price": 425.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT10",
    "name": "Bajaj RE revet batch",
    "buying_price": 250.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT11",
    "name": "super star batch",
    "buying_price": 250.0,
    "selling_price": 350.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT12",
    "name": "Nai batch(cobra batch)",
    "buying_price": 300.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT13",
    "name": "HYBRID Synergy Drive Batch",
    "buying_price": 295.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT14",
    "name": "Canaby Batch",
    "buying_price": 250.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT15",
    "name": "BMW MOTO Sport Batch",
    "buying_price": 125.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT16",
    "name": "JAPAN Batch Large",
    "buying_price": 125.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT17",
    "name": "JAPAN Batch Medium",
    "buying_price": 125.0,
    "selling_price": 400.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT18",
    "name": "JAPAN Batch Small",
    "buying_price": 125.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT19",
    "name": "Lizard Batch",
    "buying_price": 200.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT20",
    "name": "Baby In Car Batch",
    "buying_price": 125.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT21",
    "name": "King Batch Round Pair",
    "buying_price": 300.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT22",
    "name": "King Batch Box Pair",
    "buying_price": 350.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT23",
    "name": "VIP back batch",
    "buying_price": 325.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT24",
    "name": "new bej set",
    "buying_price": 185.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT25",
    "name": "3/1 pc batch packet",
    "buying_price": 220.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT26",
    "name": "3/1 pc batch packet Single Batch",
    "buying_price": 70.0,
    "selling_price": 150.0,
    "stock_quantity": 20,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS01",
    "name": "Wheel wellampiti sound set",
    "buying_price": 20000.0,
    "selling_price": 25000.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS02",
    "name": "Car Set MP3 Player",
    "buying_price": 1800.0,
    "selling_price": 2450.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS03",
    "name": "Wellampiti Loku White Box Pair",
    "buying_price": 8000.0,
    "selling_price": 9000.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS04",
    "name": "Wellampiti Loku mp3 Player Box one Door",
    "buying_price": 5500.0,
    "selling_price": 6200.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS05",
    "name": "Wellampiti Loku mp3 Player Box one Door",
    "buying_price": 5500.0,
    "selling_price": 6200.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS06",
    "name": "Wellampiti Loku 4 stock mp3 Player Box",
    "buying_price": 5250.0,
    "selling_price": 6500.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS07",
    "name": "Pioneer Speaker Pair",
    "buying_price": 7000.0,
    "selling_price": 8000.0,
    "stock_quantity": 20,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN01",
    "name": "podi bobin",
    "buying_price": 20.0,
    "selling_price": 30.0,
    "stock_quantity": 20,
    "sub_category": "Bobin",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN02",
    "name": "star bobin",
    "buying_price": 15.0,
    "selling_price": 25.0,
    "stock_quantity": 20,
    "sub_category": "Bobin",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN03",
    "name": "13 Cap Nut",
    "buying_price": 17.0,
    "selling_price": 50.0,
    "stock_quantity": 20,
    "sub_category": "Nut",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN04",
    "name": "17 Cap Nut",
    "buying_price": 23.0,
    "selling_price": 50.0,
    "stock_quantity": 20,
    "sub_category": "Nut",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN05",
    "name": "mune ana 1(8 Ena)",
    "buying_price": 20.0,
    "selling_price": 50.0,
    "stock_quantity": 20,
    "sub_category": "Ena",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN06",
    "name": "Thattu Ena 1",
    "buying_price": 45.0,
    "selling_price": 100.0,
    "stock_quantity": 20,
    "sub_category": "Ena",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBEN07",
    "name": "Round Nut Bobin",
    "buying_price": 9.0,
    "selling_price": 25.0,
    "stock_quantity": 20,
    "sub_category": "Bobin",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLVIP01",
    "name": "S12 VIP Viser(dashboard) light",
    "buying_price": 1650.0,
    "selling_price": 2250.0,
    "stock_quantity": 20,
    "sub_category": "VIP Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLVIP02",
    "name": "VIP light green box",
    "buying_price": 850.0,
    "selling_price": 1500.0,
    "stock_quantity": 20,
    "sub_category": "VIP Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLVIP03",
    "name": "white yellow light bar 4 VIP",
    "buying_price": 2500.0,
    "selling_price": 38000.0,
    "stock_quantity": 20,
    "sub_category": "VIP Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLVIP04",
    "name": "white yellow light bar 5 VIP",
    "buying_price": 3000.0,
    "selling_price": 4200.0,
    "stock_quantity": 20,
    "sub_category": "VIP Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLVIP05",
    "name": "white yellow light bar 6 VIP",
    "buying_price": 3500.0,
    "selling_price": 4800.0,
    "stock_quantity": 20,
    "sub_category": "VIP Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI01",
    "name": "Dash board",
    "buying_price": 1150.0,
    "selling_price": 1700.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI02",
    "name": "Black Dashboard",
    "buying_price": 1300.0,
    "selling_price": 1850.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI03",
    "name": "Black Dashboard  With Upper Cussion",
    "buying_price": 1350.0,
    "selling_price": 1900.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI04",
    "name": "Black Dashboard  With Set Box",
    "buying_price": 2500.0,
    "selling_price": 3395.0,
    "stock_quantity": 2,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI05",
    "name": "Heda white Dashboard",
    "buying_price": 1875.0,
    "selling_price": 2400.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI06",
    "name": "Thattu 2 Heda white Dashboard",
    "buying_price": 2475.0,
    "selling_price": 3000.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI07",
    "name": "Dashboard Bracket Q1",
    "buying_price": 250.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI08",
    "name": "Dashboard Bracket Q2",
    "buying_price": 160.0,
    "selling_price": 300.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI09",
    "name": "DJ light",
    "buying_price": 165.0,
    "selling_price": 430.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI10",
    "name": "Mini Hat Man",
    "buying_price": 495.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI11",
    "name": "Mini Joker",
    "buying_price": 495.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI12",
    "name": "loku joker",
    "buying_price": 1700.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI13",
    "name": "stand podi joker",
    "buying_price": 1300.0,
    "selling_price": 1850.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI14",
    "name": "Small joker",
    "buying_price": 1300.0,
    "selling_price": 1800.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI15",
    "name": "Doll air freshner(roboticca)",
    "buying_price": 525.0,
    "selling_price": 1000.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI16",
    "name": "Solar power dashboard helicopter",
    "buying_price": 850.0,
    "selling_price": 1300.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI17",
    "name": "dashboard ship bottle",
    "buying_price": 850.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI18",
    "name": "Dashboard solar statue",
    "buying_price": 1200.0,
    "selling_price": 1600.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI19",
    "name": "Couple Doll",
    "buying_price": 450.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI20",
    "name": "New Round Ship Bottle",
    "buying_price": 1000.0,
    "selling_price": 1600.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI21",
    "name": "USB charging port 5",
    "buying_price": 1350.0,
    "selling_price": 1850.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI22",
    "name": "phone holder",
    "buying_price": 550.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI23",
    "name": "Plasma Lamp",
    "buying_price": 1900.0,
    "selling_price": 2600.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI24",
    "name": "Phone Number Show Decor",
    "buying_price": 400.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI25",
    "name": "Sound Bar",
    "buying_price": 850.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI26",
    "name": "Speed Meter",
    "buying_price": 1950.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI27",
    "name": "Ath Dala",
    "buying_price": 240.0,
    "selling_price": 480.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI28",
    "name": "solar circle statue",
    "buying_price": 500.0,
    "selling_price": 900.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI29",
    "name": "solar circle statue with universe ball",
    "buying_price": 600.0,
    "selling_price": 1100.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI30",
    "name": "Double Fan",
    "buying_price": 1150.0,
    "selling_price": 2450.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI31",
    "name": "buwalla",
    "buying_price": 350.0,
    "selling_price": 930.0,
    "stock_quantity": 10,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI32",
    "name": "Budu Pilima S",
    "buying_price": 150.0,
    "selling_price": 250.0,
    "stock_quantity": 1,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI33",
    "name": "Budu Pilima M",
    "buying_price": 200.0,
    "selling_price": 430.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI34",
    "name": "Budu Pilima L",
    "buying_price": 280.0,
    "selling_price": 530.0,
    "stock_quantity": 20,
    "sub_category": "Dashboard Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH01",
    "name": "Siren Horn",
    "buying_price": 775.0,
    "selling_price": 1350.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH02",
    "name": "18 Sound Horn",
    "buying_price": 1025.0,
    "selling_price": 1650.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH03",
    "name": "Bseoch Horn",
    "buying_price": 850.0,
    "selling_price": 1300.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH04",
    "name": "roadmaster horn set(cicada)",
    "buying_price": 3200.0,
    "selling_price": 5000.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH05",
    "name": "Transistor Horn",
    "buying_price": 4750.0,
    "selling_price": 6180.0,
    "stock_quantity": 11,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH06",
    "name": "MIC horn",
    "buying_price": 1700.0,
    "selling_price": 2300.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH07",
    "name": "kili kili wellampiti horn circuit",
    "buying_price": 550.0,
    "selling_price": 800.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWH08",
    "name": "Primus 10 Way Horn Tuner",
    "buying_price": 575.0,
    "selling_price": 1080.0,
    "stock_quantity": 20,
    "sub_category": "Horn",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW01",
    "name": "20 AMP FUSE",
    "buying_price": 6.0,
    "selling_price": 20.0,
    "stock_quantity": 20,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW02",
    "name": "Wireness 9 Pin Front",
    "buying_price": 2450.0,
    "selling_price": 3450.0,
    "stock_quantity": 20,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW03",
    "name": "Wireness 9 Pin Back",
    "buying_price": 2000.0,
    "selling_price": 3000.0,
    "stock_quantity": 20,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP01",
    "name": "Plastic Oil Bottle",
    "buying_price": 300.0,
    "selling_price": 630.0,
    "stock_quantity": 5,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP02",
    "name": "PFC Oil",
    "buying_price": 300.0,
    "selling_price": 500.0,
    "stock_quantity": 20,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP03",
    "name": "Gear cable",
    "buying_price": 55.0,
    "selling_price": 120.0,
    "stock_quantity": 20,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP04",
    "name": "Clutch cable",
    "buying_price": 55.0,
    "selling_price": 120.0,
    "stock_quantity": 20,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP05",
    "name": "Accelarator cable",
    "buying_price": 50.0,
    "selling_price": 120.0,
    "stock_quantity": 20,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP06",
    "name": "Petrol Mudi",
    "buying_price": 45.0,
    "selling_price": 150.0,
    "stock_quantity": 50,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBB01",
    "name": "VIP Blink LED",
    "buying_price": 125.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Bulb",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBB02",
    "name": "Red Flash Blink LED",
    "buying_price": 110.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Bulb",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBB03",
    "name": "Beak Blink LED",
    "buying_price": 75.0,
    "selling_price": 150.0,
    "stock_quantity": 20,
    "sub_category": "Bulb",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBB04",
    "name": "Break LED",
    "buying_price": 40.0,
    "selling_price": 100.0,
    "stock_quantity": 20,
    "sub_category": "Bulb",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBB05",
    "name": "Signal Light LED",
    "buying_price": 40.0,
    "selling_price": 100.0,
    "stock_quantity": 20,
    "sub_category": "Bulb",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "CI01",
    "name": "Flash Air Freshner 475 ml",
    "buying_price": 390.0,
    "selling_price": 520.0,
    "stock_quantity": 20,
    "sub_category": "Company Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "CI02",
    "name": "Flash Distilled Water 500 ml",
    "buying_price": 110.0,
    "selling_price": 140.0,
    "stock_quantity": 20,
    "sub_category": "Company Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "CI03",
    "name": "Flash Distilled Water 1000 ml",
    "buying_price": 170.0,
    "selling_price": 225.0,
    "stock_quantity": 20,
    "sub_category": "Company Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "CI04",
    "name": "Flash Car Wash 500 ml",
    "buying_price": 320.0,
    "selling_price": 425.0,
    "stock_quantity": 20,
    "sub_category": "Company Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "CI05",
    "name": "Flash Ever Shine 200 ml",
    "buying_price": 480.0,
    "selling_price": 635.0,
    "stock_quantity": 20,
    "sub_category": "Company Item",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP01",
    "name": "Platina Tank Cover",
    "buying_price": 425.0,
    "selling_price": 1080.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP02",
    "name": "CT-100 Tank Cover",
    "buying_price": 425.0,
    "selling_price": 1080.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP03",
    "name": "Pulser Tank Cover",
    "buying_price": 425.0,
    "selling_price": 1080.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP04",
    "name": "Full Glows",
    "buying_price": 850.0,
    "selling_price": 1380.0,
    "stock_quantity": 6,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP05",
    "name": "Full Face Googles",
    "buying_price": 1500.0,
    "selling_price": 2480.0,
    "stock_quantity": 3,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP06",
    "name": "Normal Helmet Visor",
    "buying_price": 170.0,
    "selling_price": 480.0,
    "stock_quantity": 10,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP07",
    "name": "Vega Visor",
    "buying_price": 1050.0,
    "selling_price": 1780.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP08",
    "name": "Dio Nickle Silancer Guard",
    "buying_price": 1100.0,
    "selling_price": 1830.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP09",
    "name": "Bajaj Nickle Silancer Guard",
    "buying_price": 1050.0,
    "selling_price": 1830.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP10",
    "name": "NTorqe Nickle Silancer Guard",
    "buying_price": 1200.0,
    "selling_price": 1830.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP11",
    "name": "FZ Nickle Silancer Guard",
    "buying_price": 1000.0,
    "selling_price": 1830.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP12",
    "name": "ZR Nickle Silancer Guard",
    "buying_price": 1050.0,
    "selling_price": 1830.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP13",
    "name": "CT 100 Nickle Silancer Guard",
    "buying_price": 1050.0,
    "selling_price": 1830.0,
    "stock_quantity": 2,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP14",
    "name": "Bike Round Kadana Mirror Q1",
    "buying_price": 1650.0,
    "selling_price": 2830.0,
    "stock_quantity": 5,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP15",
    "name": "Bike Round Kadana Mirror Q2",
    "buying_price": 1500.0,
    "selling_price": 2180.0,
    "stock_quantity": 5,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP16",
    "name": "KOSO Voltage Meter",
    "buying_price": 950.0,
    "selling_price": 1580.0,
    "stock_quantity": 5,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP17",
    "name": "Handle Round Small Mirror",
    "buying_price": 290.0,
    "selling_price": 530.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP18",
    "name": "Duck Decore",
    "buying_price": 450.0,
    "selling_price": 830.0,
    "stock_quantity": 10,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP19",
    "name": "Key Tag 01",
    "buying_price": 95.0,
    "selling_price": 330.0,
    "stock_quantity": 12,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP20",
    "name": "Key Tag 02",
    "buying_price": 220.0,
    "selling_price": 480.0,
    "stock_quantity": 12,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP21",
    "name": "Key Tag 03",
    "buying_price": 175.0,
    "selling_price": 430.0,
    "stock_quantity": 12,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP22",
    "name": "Key Tag 04",
    "buying_price": 135.0,
    "selling_price": 380.0,
    "stock_quantity": 12,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP23",
    "name": "Key Tag 05 Rubber Podi",
    "buying_price": 45.0,
    "selling_price": 250.0,
    "stock_quantity": 15,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP24",
    "name": "Key Tag 06 Redi Pati",
    "buying_price": 80.0,
    "selling_price": 250.0,
    "stock_quantity": 10,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP25",
    "name": "Key Tag 07",
    "buying_price": 45.0,
    "selling_price": 150.0,
    "stock_quantity": 12,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP26",
    "name": "Key Tag 08",
    "buying_price": 95.0,
    "selling_price": 330.0,
    "stock_quantity": 12,
    "sub_category": "Key Tag",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP27",
    "name": "Bike Fuse",
    "buying_price": 20.0,
    "selling_price": 30.0,
    "stock_quantity": 20,
    "sub_category": "Fuse",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP28",
    "name": "DRL Light",
    "buying_price": 250.0,
    "selling_price": 450.0,
    "stock_quantity": 16,
    "sub_category": "Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP29",
    "name": "modify air filter",
    "buying_price": 550.0,
    "selling_price": 1100.0,
    "stock_quantity": 6,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP30",
    "name": "modify bike number plate bracket",
    "buying_price": 2000.0,
    "selling_price": 3000.0,
    "stock_quantity": 3,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP31",
    "name": "motorcycle normal horn",
    "buying_price": 195.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP32",
    "name": "modify break light ct100/platina",
    "buying_price": 1450.0,
    "selling_price": 2500.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP33",
    "name": "Modify Bike Stand",
    "buying_price": 1000.0,
    "selling_price": 1750.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP34",
    "name": "Crash Bobin",
    "buying_price": 475.0,
    "selling_price": 900.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP35",
    "name": "ProTaper Break Rubber",
    "buying_price": 75.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP36",
    "name": "Gear Rubber",
    "buying_price": 75.0,
    "selling_price": 250.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP37",
    "name": "Dio Side Mirror",
    "buying_price": 675.0,
    "selling_price": 1150.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP38",
    "name": "Pulzer Side Mirror",
    "buying_price": 650.0,
    "selling_price": 1100.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP39",
    "name": "CG 125 Side Mirror",
    "buying_price": 575.0,
    "selling_price": 950.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP40",
    "name": "112 Modify Signal Light",
    "buying_price": 695.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP41",
    "name": "113  Modify Signal Light",
    "buying_price": 695.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP42",
    "name": "114  Modify Signal Light",
    "buying_price": 695.0,
    "selling_price": 1200.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP43",
    "name": "Monster Footress",
    "buying_price": 350.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP44",
    "name": "Kaiser H4 Bulb",
    "buying_price": 250.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP45",
    "name": "Kaiser H4 Bulb Bulb",
    "buying_price": 350.0,
    "selling_price": 600.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP46",
    "name": "Bike Normal Balck Number Plate Bracket",
    "buying_price": 200.0,
    "selling_price": 450.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP47",
    "name": "Samsung Light Pati Small",
    "buying_price": 40.0,
    "selling_price": 70.0,
    "stock_quantity": 20,
    "sub_category": "Light Pati",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP48",
    "name": "Spork Bata",
    "buying_price": 525.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP49",
    "name": "Shocket Adjuster",
    "buying_price": 525.0,
    "selling_price": 850.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP50",
    "name": "ProTaper Grip 1",
    "buying_price": 425.0,
    "selling_price": 750.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP51",
    "name": "ProTaper Grip Old 2",
    "buying_price": 390.0,
    "selling_price": 550.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP52",
    "name": "ProTaper FootRess 1",
    "buying_price": 450.0,
    "selling_price": 700.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP53",
    "name": "Lever Guard Plastic",
    "buying_price": 750.0,
    "selling_price": 1250.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BP54",
    "name": "Balance Bar",
    "buying_price": 400.0,
    "selling_price": 650.0,
    "stock_quantity": 20,
    "sub_category": "Bike Parts",
    "category": "Three-Wheel"
  }
];

async function seedInventory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`\n📦 Seeding ${inventoryData.length} Mixed Parts (Sound, VIP Lights, Dash Items, etc)...`);
    console.log('─'.repeat(90));

    let added = 0, updated = 0;

    for (const item of inventoryData) {
      const exists = await Product.findOne({ sku_code: item.sku_code });
      if (exists) {
        await Product.findOneAndUpdate({ sku_code: item.sku_code }, {
          name: item.name,
          buying_price: item.buying_price,
          selling_price: item.selling_price,
          sub_category: item.sub_category,
          stock_quantity: item.stock_quantity, 
          category: item.category,
        });
        console.log(`  ↺ Updated : ${item.sku_code} | ${item.name}`);
        updated++;
      } else {
        await Product.create(item);
        const margin = item.selling_price > 0 ? (((item.selling_price - item.buying_price) / item.selling_price) * 100).toFixed(0) : 0;
        console.log(`  ✅ Added  : ${item.sku_code} | ${item.name.padEnd(55)} | Buy: Rs.${String(item.buying_price).padStart(5)} | Sell: Rs.${String(item.selling_price).padStart(5)} | Margin: ${margin}%`);
        added++;
      }
    }

    console.log('─'.repeat(90));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Newly added : ${added}`);
    console.log(`   ↺ Updated     : ${updated}`);
    console.log(`   Total processed: ${inventoryData.length}`);
    console.log('\n🎉 Parts seed complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedInventory();
