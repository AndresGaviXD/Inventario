using System.Security.Claims;
using InventarioApi.Data;
using InventarioApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventarioApi.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class InventarioController : ControllerBase
{
    private readonly InventarioRepository _repo;
    public InventarioController(InventarioRepository repo) => _repo = repo;

    [HttpGet("inventario")]
    public async Task<ActionResult<IEnumerable<InventarioItem>>> Estado()
        => Ok(await _repo.EstadoAsync());

    [HttpGet("movimientos")]
    public async Task<ActionResult<IEnumerable<MovimientoItem>>> Movimientos([FromQuery] int limite = 50)
        => Ok(await _repo.MovimientosAsync(Math.Clamp(limite, 1, 500)));

    [HttpPost("movimientos/entrada")]
    public async Task<IActionResult> Entrada(MovimientoRequest req)
    {
        await _repo.RegistrarEntradaAsync(req, UserId());
        return Ok(new { mensaje = "Entrada registrada correctamente" });
    }

    [HttpPost("movimientos/salida")]
    public async Task<IActionResult> Salida(MovimientoRequest req)
    {
        await _repo.RegistrarSalidaAsync(req, UserId());
        return Ok(new { mensaje = "Salida registrada correctamente" });
    }

    private int? UserId()
    {
        var v = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(v, out var id) ? id : null;
    }
}