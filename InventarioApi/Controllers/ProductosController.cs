using InventarioApi.Data;
using InventarioApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventarioApi.Controllers;

[ApiController]
[Authorize]
[Route("api/productos")]
public class ProductosController : ControllerBase
{
    private readonly InventarioRepository _repo;
    public ProductosController(InventarioRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Producto>>> Listar([FromQuery] bool incluirInactivos = false)
        => Ok(await _repo.ProductosAsync(incluirInactivos && User.IsInRole("admin")));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Crear(ProductoRequest req)
    {
        req.Codigo = req.Codigo.Trim();
        req.Nombre = req.Nombre.Trim();
        var id = await _repo.CrearProductoAsync(req);
        return StatusCode(201, new { id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Actualizar(int id, ProductoRequest req)
    {
        req.Codigo = req.Codigo.Trim();
        req.Nombre = req.Nombre.Trim();
        var ok = await _repo.ActualizarProductoAsync(id, req);
        return ok ? Ok(new { mensaje = "Producto actualizado" })
                  : NotFound(new { error = "Producto no encontrado" });
    }

    [HttpPost("{id:int}/desactivar")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Desactivar(int id)
    {
        await _repo.DesactivarProductoAsync(id);
        return Ok(new { mensaje = "Producto desactivado" });
    }

    [HttpPost("{id:int}/reactivar")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reactivar(int id)
    {
        var ok = await _repo.ReactivarProductoAsync(id);
        return ok ? Ok(new { mensaje = "Producto reactivado" })
                  : NotFound(new { error = "Producto no encontrado" });
    }
}