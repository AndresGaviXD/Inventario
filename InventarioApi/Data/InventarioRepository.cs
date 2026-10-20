using Dapper;
using InventarioApi.Models;

namespace InventarioApi.Data;

public class InventarioRepository
{
    private readonly Db _db;
    public InventarioRepository(Db db) => _db = db;

    public async Task RegistrarEntradaAsync(MovimientoRequest r, int? userId)
    {
        await using var c = _db.Create();
        await c.ExecuteAsync(
            "CALL sp_registrar_entrada(@ProductoId, @Cantidad, @Observacion, @UserId)",
            new { r.ProductoId, r.Cantidad, r.Observacion, UserId = userId });
    }

    public async Task RegistrarSalidaAsync(MovimientoRequest r, int? userId)
    {
        await using var c = _db.Create();
        await c.ExecuteAsync(
            "CALL sp_registrar_salida(@ProductoId, @Cantidad, @Observacion, @UserId)",
            new { r.ProductoId, r.Cantidad, r.Observacion, UserId = userId });
    }

    public async Task<IEnumerable<InventarioItem>> EstadoAsync()
    {
        await using var c = _db.Create();
        return await c.QueryAsync<InventarioItem>("SELECT * FROM sp_estado_inventario()");
    }

    public async Task<IEnumerable<MovimientoItem>> MovimientosAsync(int limite = 50)
    {
        await using var c = _db.Create();
        return await c.QueryAsync<MovimientoItem>(
            "SELECT * FROM sp_listar_movimientos(@limite)", new { limite });
    }

    public async Task<IEnumerable<Producto>> ProductosAsync(bool incluirInactivos = false)
    {
        await using var c = _db.Create();
        return await c.QueryAsync<Producto>(
            @"SELECT id, codigo, nombre, descripcion, stock_minimo AS StockMinimo, activo
                FROM productos
               WHERE (@incluir OR activo)
               ORDER BY nombre", new { incluir = incluirInactivos });
    }

    public async Task<int> CrearProductoAsync(ProductoRequest p)
    {
        await using var c = _db.Create();
        return await c.ExecuteScalarAsync<int>(
            @"INSERT INTO productos (codigo, nombre, descripcion, stock_minimo)
              VALUES (@Codigo, @Nombre, @Descripcion, @StockMinimo) RETURNING id", p);
    }

    public async Task<bool> ActualizarProductoAsync(int id, ProductoRequest p)
    {
        await using var c = _db.Create();
        var n = await c.ExecuteAsync(
            @"UPDATE productos
                 SET codigo = @Codigo, nombre = @Nombre,
                     descripcion = @Descripcion, stock_minimo = @StockMinimo
               WHERE id = @id",
            new { id, p.Codigo, p.Nombre, p.Descripcion, p.StockMinimo });
        return n > 0;
    }

    public async Task DesactivarProductoAsync(int id)
    {
        await using var c = _db.Create();
        await c.ExecuteAsync("CALL sp_desactivar_producto(@id)", new { id });
    }

    public async Task<bool> ReactivarProductoAsync(int id)
    {
        await using var c = _db.Create();
        return await c.ExecuteAsync(
            "UPDATE productos SET activo = TRUE WHERE id = @id", new { id }) > 0;
    }

    public async Task<UsuarioRow?> BuscarUsuarioAsync(string username)
    {
        await using var c = _db.Create();
        return await c.QuerySingleOrDefaultAsync<UsuarioRow>(
            @"SELECT id, password_hash AS PasswordHash, rol, activo
                FROM usuarios WHERE username = @username", new { username });
    }

    public async Task<int> CrearUsuarioAsync(string username, string hash, string rol)
    {
        await using var c = _db.Create();
        return await c.ExecuteScalarAsync<int>(
            @"INSERT INTO usuarios (username, password_hash, rol)
              VALUES (@username, @hash, @rol) RETURNING id",
            new { username, hash, rol });
    }

    public async Task<IEnumerable<UsuarioItem>> UsuariosAsync()
    {
        await using var c = _db.Create();
        return await c.QueryAsync<UsuarioItem>(
            @"SELECT id, username, rol, activo, created_at AS CreatedAt
                FROM usuarios ORDER BY username");
    }

    public async Task<bool> CambiarRolAsync(int id, string rol)
    {
        await using var c = _db.Create();
        return await c.ExecuteAsync(
            "UPDATE usuarios SET rol = @rol WHERE id = @id", new { id, rol }) > 0;
    }

    public async Task<bool> CambiarEstadoUsuarioAsync(int id, bool activo)
    {
        await using var c = _db.Create();
        return await c.ExecuteAsync(
            "UPDATE usuarios SET activo = @activo WHERE id = @id", new { id, activo }) > 0;
    }
}