/** Varnada Lagna (වර්ණද ලග්නය) per BPHS ch. 5 sl. 10–13½ — see docs/warnada-lagna.md.
 *
 *  Uses only the Rāśi of the Janma Lagna and of the Hora Lagna (no degrees). */
export interface VarnadaLagnaResult {
    natalLagna: number;
    horaLagna: number;
    natalCount: number;
    horaCount: number;
    operation: "ADD" | "SUBTRACT";
    finalCount: number;
    direction: "FORWARD_FROM_ARIES" | "BACKWARD_FROM_PISCES";
    /** Sign 1-12. */
    sign: number;
}

/** Odd signs count forward from Aries, even signs backward from Pisces. */
const directionalCount = (sign: number) => (sign % 2 === 1 ? sign : 13 - sign);

const isValidSign = (sign: number) => Number.isInteger(sign) && sign >= 1 && sign <= 12;

export const calculateVarnadaLagna = (natalLagna: number, horaLagna: number): VarnadaLagnaResult => {
    if (!isValidSign(natalLagna) || !isValidSign(horaLagna)) {
        throw new Error("Lagna signs must be integers between 1 and 12");
    }

    const natalCount = directionalCount(natalLagna);
    const horaCount = directionalCount(horaLagna);

    // Both lagnas in odd signs or both in even signs → add; otherwise subtract the smaller count from
    // the larger. The parity is of the signs, not of the counts (the counts are always odd).
    const sameParity = natalLagna % 2 === horaLagna % 2;
    const finalCount = sameParity ? natalCount + horaCount : Math.abs(natalCount - horaCount);

    // The Janma Lagna sets the direction: odd → forward from Aries, even → backward from Pisces.
    // (The final count is always even, so its parity can't decide this.) Counting is inclusive — the
    // starting sign is 1 — and a 0 (equal counts subtracted) stays on the starting sign.
    const forward = natalLagna % 2 === 1;
    const steps = Math.max(finalCount, 1) - 1;
    const index = forward ? steps % 12 : 11 - (steps % 12);

    return {
        natalLagna,
        horaLagna,
        natalCount,
        horaCount,
        operation: sameParity ? "ADD" : "SUBTRACT",
        finalCount,
        direction: forward ? "FORWARD_FROM_ARIES" : "BACKWARD_FROM_PISCES",
        sign: index + 1,
    };
};
