import { describe, expect, it } from "vitest";
import { calculateAccountBalances, calculateCashTotal, calculateWealthTotals, isDebtOpen } from "@/lib/finance";

const accounts = [
  { id: "renan", initial_balance: 100, initial_status: "confirmado" },
  { id: "leticia", initial_balance: 50, initial_status: "confirmado" },
  { id: "mp", initial_balance: 0, initial_status: "a_confirmar" },
];

describe("financial ledger", () => {
  it("applies confirmed income and expenses to their own account", () => {
    const balances = calculateAccountBalances(accounts, [
      { status: "confirmado", direction: "entrada", amount: 250.1, account_id: "renan" },
      { status: "confirmado", direction: "saida", amount: 25.1, account_id: "renan" },
      { status: "a_confirmar", direction: "entrada", amount: 900, account_id: "leticia" },
    ]);

    expect(balances.map((account) => account.balance)).toEqual([325, 50, 0]);
  });

  it("moves money between accounts without changing consolidated cash", () => {
    const movements = [
      { status: "confirmado", direction: "transferencia", amount: 40.25, account_id: "renan", transfer_account_id: "mp" },
    ];

    expect(calculateAccountBalances(accounts, movements).map((account) => account.balance)).toEqual([
      59.75, 50, 40.25,
    ]);
    expect(calculateCashTotal(accounts, movements)).toBe(150);
  });

  it("uses integer cents to avoid floating-point drift", () => {
    const movements = Array.from({ length: 100 }, () => ({
      status: "confirmado",
      direction: "entrada",
      amount: 0.1,
      account_id: "renan",
    }));

    expect(calculateAccountBalances(accounts, movements)[0].balance).toBe(110);
  });

  it("marks pending opening balances as partial instead of silently confirmed", () => {
    const balances = calculateAccountBalances(accounts, [
      { status: "confirmado", direction: "entrada", amount: 20, account_id: "mp" },
    ]);
    expect(balances[0].balance_status).toBe("confirmado");
    expect(balances[1].balance_status).toBe("confirmado");
    expect(balances[2].balance_status).toBe("parcial");
  });

  it("calculates net worth from confirmed assets, cash and open liabilities only", () => {
    const wealth = calculateWealthTotals(
      [
        { kind: "ativo", class: "veículo", value: 10000, status: "confirmado" },
        { kind: "ativo", class: "conta bancária", value: 5000, status: "confirmado" },
        { kind: "passivo", class: "contrato", value: 1000, status: "confirmado" },
        { kind: "ativo", class: "imóvel", value: 90000, status: "a_confirmar" },
      ],
      [
        { status: "ativa", balance_informed: 2000 },
        { status: "paga", balance_informed: 7000 },
      ],
      accounts,
      [{ status: "confirmado", direction: "entrada", amount: 100, account_id: "renan" }],
    );
    expect(wealth.assetValue).toBe(10000);
    expect(wealth.assetLiabilities).toBe(1000);
    expect(wealth.debtTotal).toBe(2000);
    expect(wealth.cashTotal).toBe(170);
    expect(wealth.netWorth).toBe(7170);
  });

  it("uses the same open-debt rule in every dashboard", () => {
    expect(isDebtOpen({ status: "ativa" })).toBe(true);
    expect(isDebtOpen({ status: "atrasada" })).toBe(true);
    expect(isDebtOpen({ status: "a_confirmar" })).toBe(false);
    expect(isDebtOpen({ status: "PAGA" })).toBe(false);
    expect(isDebtOpen({ status: "quitada" })).toBe(false);
  });
});
