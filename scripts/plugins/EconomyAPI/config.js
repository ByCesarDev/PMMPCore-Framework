export const ECONOMY_PLUGIN_NAME = "EconomyAPI";
export const ECONOMY_SCHEMA_VERSION = 1;

export const ECONOMY_PERMISSIONS = Object.freeze({
  mymoney: "economy.command.mymoney",
  mydebt: "economy.command.mydebt",
  takedebt: "economy.command.takedebt",
  returndebt: "economy.command.returndebt",
  topmoney: "economy.command.topmoney",
  pay: "economy.command.pay",
  seemoney: "economy.command.seemoney",
  mystatus: "economy.command.mystatus",
  bank: "economy.command.bank",
  economys: "economy.command.economys",
  setmoney: "economy.admin.setmoney",
  givemoney: "economy.admin.givemoney",
  takemoney: "economy.admin.takemoney",
  bankadmin: "economy.admin.bank",
  moneysave: "economy.admin.save",
  moneyload: "economy.admin.load",
});

export const ECONOMY_DEFAULTS = Object.freeze({
  showUsingEconomy: true,
  onceDebtLimit: 100,
  debtLimit: 500,
  addOpAtRank: false,
  defaultMoney: 1000,
  defaultDebt: 0,
  defaultBankMoney: 0,
  timeForIncreaseDebt: 10,
  percentOfIncreaseDebt: 5,
  timeForIncreaseMoney: 10,
  bankIncreaseMoneyRate: 5,
  allowPayOffline: true,
  debug: true,
  topPageSize: 5,
});
