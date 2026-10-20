using Npgsql;

namespace InventarioApi.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _log;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> log)
    {
        _next = next;
        _log = log;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (PostgresException ex)
        {
            var (status, msg) = ex.SqlState switch
            {
                "IN001" => (400, ex.MessageText),
                "IN002" => (404, ex.MessageText),
                "IN003" => (409, ex.MessageText),
                "IN004" => (409, ex.MessageText),
                "23505" => (409, "Ya existe un registro con ese valor único (código o usuario)."),
                _ => (500, "Error en la base de datos.")
            };
            if (status == 500) _log.LogError(ex, "Error de base de datos");
            await Responder(ctx, status, msg);
        }
        catch (NpgsqlException ex)
        {
            _log.LogError(ex, "No se pudo conectar a la base de datos");
            await Responder(ctx, 503, "No se pudo conectar a la base de datos.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error no controlado");
            await Responder(ctx, 500, "Error interno del servidor.");
        }
    }

    private static Task Responder(HttpContext ctx, int status, string msg)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = msg });
    }
}