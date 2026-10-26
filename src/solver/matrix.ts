export type Matrix = number[][];

export function zeros(rows: number, columns: number): Matrix {
  return Array.from({ length: rows }, () => Array<number>(columns).fill(0));
}

export function transpose(matrix: Matrix): Matrix {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const result = zeros(columns, rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) result[column]![row] = matrix[row]![column]!;
  }
  return result;
}

export function multiply(left: Matrix, right: Matrix): Matrix {
  const rows = left.length;
  const shared = left[0]?.length ?? 0;
  const columns = right[0]?.length ?? 0;
  const result = zeros(rows, columns);
  for (let row = 0; row < rows; row += 1) {
    for (let k = 0; k < shared; k += 1) {
      const value = left[row]![k]!;
      for (let column = 0; column < columns; column += 1) result[row]![column] = result[row]![column]! + value * right[k]![column]!;
    }
  }
  return result;
}

export function multiplyMatrixVector(matrix: Matrix, vector: readonly number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index]!, 0));
}

export function quadraticTransform(local: Matrix, transform: Matrix): Matrix {
  return multiply(multiply(transpose(transform), local), transform);
}

export function solveSmallDense(matrix: Matrix, rightHandSide: readonly number[]): number[] {
  const n = matrix.length;
  const augmented = matrix.map((row, index) => [...row, rightHandSide[index]!]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row]![pivot]!) > Math.abs(augmented[best]![pivot]!)) best = row;
    }
    if (Math.abs(augmented[best]![pivot]!) <= Number.EPSILON) throw new Error("Вырожденный блок конденсации.");
    [augmented[pivot], augmented[best]] = [augmented[best]!, augmented[pivot]!];
    const divisor = augmented[pivot]![pivot]!;
    for (let column = pivot; column <= n; column += 1) augmented[pivot]![column] = augmented[pivot]![column]! / divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row]![pivot]!;
      for (let column = pivot; column <= n; column += 1) augmented[row]![column] = augmented[row]![column]! - factor * augmented[pivot]![column]!;
    }
  }
  return augmented.map((row) => row[n]!);
}

export class SingularMatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SingularMatrixError";
  }
}

export function solveSymmetricPositiveDefinite(
  matrix: Matrix,
  rightHandSide: readonly number[],
  tolerance: number
): { solution: number[]; relativeResidual: number } {
  const n = matrix.length;
  if (n === 0) return { solution: [], relativeResidual: 0 };
  const diagonalScale = matrix.map((row, index) => {
    const diagonal = row[index]!;
    if (!Number.isFinite(diagonal) || diagonal <= 0) throw new SingularMatrixError("Неположительная диагональ матрицы жёсткости.");
    return 1 / Math.sqrt(diagonal);
  });
  const scaled = zeros(n, n);
  let maxAsymmetry = 0;
  for (let row = 0; row < n; row += 1) {
    for (let column = 0; column < n; column += 1) {
      const value = matrix[row]![column]! * diagonalScale[row]! * diagonalScale[column]!;
      if (!Number.isFinite(value)) throw new Error("Матрица содержит нечисловое значение.");
      scaled[row]![column] = value;
      maxAsymmetry = Math.max(maxAsymmetry, Math.abs(value - matrix[column]![row]! * diagonalScale[column]! * diagonalScale[row]!));
    }
  }
  if (maxAsymmetry > Math.max(1e-12, tolerance * 10)) throw new Error("Матрица жёсткости потеряла симметрию.");

  const scaledRight = rightHandSide.map((value, index) => value * diagonalScale[index]!);
  const lower = zeros(n, n);
  let minPivot = Number.POSITIVE_INFINITY;
  let maxPivot = 0;
  for (let row = 0; row < n; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let sum = scaled[row]![column]!;
      for (let k = 0; k < column; k += 1) sum -= lower[row]![k]! * lower[column]![k]!;
      if (row === column) {
        if (!Number.isFinite(sum) || sum <= tolerance) throw new SingularMatrixError(`Нулевой или отрицательный pivot для степени свободы ${row}.`);
        lower[row]![column] = Math.sqrt(sum);
        minPivot = Math.min(minPivot, sum);
        maxPivot = Math.max(maxPivot, sum);
      } else {
        lower[row]![column] = sum / lower[column]![column]!;
      }
    }
  }
  if (minPivot / maxPivot <= tolerance) throw new SingularMatrixError("Матрица плохо обусловлена относительно заданного допуска.");

  const intermediate = Array<number>(n).fill(0);
  for (let row = 0; row < n; row += 1) {
    let sum = scaledRight[row]!;
    for (let column = 0; column < row; column += 1) sum -= lower[row]![column]! * intermediate[column]!;
    intermediate[row] = sum / lower[row]![row]!;
  }
  const scaledSolution = Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = intermediate[row]!;
    for (let column = row + 1; column < n; column += 1) sum -= lower[column]![row]! * scaledSolution[column]!;
    scaledSolution[row] = sum / lower[row]![row]!;
  }
  const solution = scaledSolution.map((value, index) => value * diagonalScale[index]!);
  const residual = multiplyMatrixVector(matrix, solution).map((value, index) => value - rightHandSide[index]!);
  const residualNorm = Math.max(0, ...residual.map(Math.abs));
  const rhsNorm = Math.max(1, ...rightHandSide.map(Math.abs));
  const relativeResidual = residualNorm / rhsNorm;
  if (!Number.isFinite(relativeResidual) || relativeResidual > Math.max(1e-9, tolerance * 100)) {
    throw new Error(`Недопустимый относительный остаток ${relativeResidual}.`);
  }
  return { solution, relativeResidual };
}
