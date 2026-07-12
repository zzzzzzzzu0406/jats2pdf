declare module "pagedjs" {
  export interface PagedFlow {
    total: number;
    pages: unknown[];
  }

  export class Previewer {
    preview(
      content: string | HTMLElement,
      stylesheets?: string[],
      renderTo?: HTMLElement,
    ): Promise<PagedFlow>;
  }
}
