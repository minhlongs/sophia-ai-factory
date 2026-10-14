export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
