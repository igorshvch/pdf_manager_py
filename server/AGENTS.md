# Backend Guidelines

- Use Python 3.11 compatible syntax.
- Prefer Flask for HTTP endpoints and keep route handlers slim by delegating logic to helper modules.
- Every public function should include a docstring that describes inputs/outputs.
- Keep comments explanatory—assume another agent will extend the server later.
- Store mutable runtime data under `server/storage` and keep the directory Git-tracked with placeholders if needed.

