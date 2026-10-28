/** Miles con punto (es-CL), independiente de los datos de locale del navegador. */
export const formatNumber = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
