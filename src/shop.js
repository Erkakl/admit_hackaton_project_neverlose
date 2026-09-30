import { sounds } from './audio.js';

export class ShopManager {
  constructor(robot, onUpdateCallback) {
    this.robot = robot;
    this.onUpdateCallback = onUpdateCallback;

    const saved = localStorage.getItem('daduino_hackathon_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.coins = parsed.coins || 0;
        this.upgrades = parsed.upgrades || { engine: 0, chassis: 0, camera: 0, magnet: 0 };
      } catch (e) {
        this._initDefault();
      }
    } else {
      this._initDefault();
    }

    this.catalog = {
      engine: {
        title: '🏎️ Двигатели',
        levels: [
          { name: 'Ржавый моторчик от игрушки', desc: 'Макс. скорость 0.35 м/с', price: 0 },
          { name: 'Редукторы DaDuino TT-Motor', desc: 'Макс. скорость 0.70 м/с', price: 30 },
          { name: 'Турбо-привод Cyber Brushless', desc: 'Макс. скорость 1.15 м/с', price: 80 }
        ]
      },
      chassis: {
        title: '🛡️ Корпус и шасси',
        levels: [
          { name: 'Картонная коробка с изолентой', desc: 'Нищий самодельный бот', price: 0 },
          { name: 'Акриловый DaDuino v3.2', desc: 'Двухъярусная платформа со стойками', price: 40 },
          { name: 'Кибер-карбон с неоном и спойлером', desc: 'Аэродинамический каркас', price: 90 }
        ]
      },
      camera: {
        title: '📷 Камера и сенсор',
        levels: [
          { name: 'Старая вебка на палочке', desc: 'Базовый обзор, шумы сенсора', price: 0 },
          { name: 'Модуль Kendryte K210 AI', desc: 'FOV 65°, детекция AprilTag ID:6', price: 50 },
          { name: 'KPU Neuro-Scanner + Лазер', desc: 'Лазерный целеуказатель и сканер', price: 100 }
        ]
      },
      magnet: {
        title: '🧲 Магнит для монет',
        levels: [
          { name: 'Без магнита', desc: 'Только прямой наезд (0.25 м)', price: 0 },
          { name: 'Неодимовый магнит', desc: 'Притягивает монеты в радиусе 0.9 м', price: 35 },
          { name: 'Ионный грави-захват', desc: 'Притягивает монеты в радиусе 1.8 м', price: 75 }
        ]
      }
    };

    this.robot.applyUpgrades(this.upgrades);
  }

  _initDefault() {
    this.coins = 0;
    this.upgrades = {
      engine: 0,
      chassis: 0,
      camera: 0,
      magnet: 0
    };
  }

  save() {
    localStorage.setItem('daduino_hackathon_save', JSON.stringify({
      coins: this.coins,
      upgrades: this.upgrades
    }));
  }

  addCoins(amount = 1) {
    this.coins += amount;
    sounds.playCoin();
    this.save();
    if (this.onUpdateCallback) this.onUpdateCallback();
  }

  getMagnetRadius() {
    const lvl = this.upgrades.magnet || 0;
    if (lvl === 0) return 0.25;
    if (lvl === 1) return 0.90;
    return 1.80;
  }

  buyUpgrade(cat) {
    const item = this.catalog[cat];
    if (!item) return false;

    const currentLvl = this.upgrades[cat] || 0;
    const nextLvl = currentLvl + 1;

    if (nextLvl >= item.levels.length) {
      return false; 
    }

    const price = item.levels[nextLvl].price;
    if (this.coins < price) {
      return false; 
    }

    this.coins -= price;
    this.upgrades[cat] = nextLvl;
    this.robot.applyUpgrades(this.upgrades);

    sounds.playUpgrade();
    this.save();

    if (this.onUpdateCallback) this.onUpdateCallback();
    return true;
  }

  resetProgress() {
    this._initDefault();
    this.robot.applyUpgrades(this.upgrades);
    this.save();
    if (this.onUpdateCallback) this.onUpdateCallback();
  }
}
