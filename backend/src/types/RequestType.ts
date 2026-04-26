type RequestType<
  B = unknown,
  P = void,
  Q = void,
> = {
  body: B;
} & (P extends void ? { params?: never } : { params: P })
  & (Q extends void ? { query?: never } : { query: Q });

export default RequestType;
