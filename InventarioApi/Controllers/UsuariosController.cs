using System.Security.Claims;
using InventarioApi.Data;
using InventarioApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventarioApi.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/usuarios")]
public class UsuariosController : ControllerBase
{
    private readonly InventarioRepository _repo;
    public UsuariosController(InventarioRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UsuarioItem>>> Listar()
        => Ok(await _repo.UsuariosAsync());

    [HttpPost]
    public async Task<IActionResult> Crear(UsuarioRequest req)
    {
        var hash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        var id = await _repo.CrearUsuarioAsync(req.Username.Trim(), hash, req.Rol);
        return StatusCode(201, new { id });
    }

    [HttpPut("{id:int}/rol")]
    public async Task<IActionResult> CambiarRol(int id, RolRequest req)
    {
        if (id == UserId())
            return BadRequest(new { error = "No puede cambiar su propio rol" });

        var ok = await _repo.CambiarRolAsync(id, req.Rol);
        return ok ? Ok(new { mensaje = "Rol actualizado" })
                  : NotFound(new { error = "Usuario no encontrado" });
    }

    [HttpPut("{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, EstadoRequest req)
    {
        if (id == UserId())
            return BadRequest(new { error = "No puede desactivar su propio usuario" });

        var ok = await _repo.CambiarEstadoUsuarioAsync(id, req.Activo);
        return ok ? Ok(new { mensaje = req.Activo ? "Usuario activado" : "Usuario desactivado" })
                  : NotFound(new { error = "Usuario no encontrado" });
    }

    private int? UserId()
    {
        var v = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(v, out var id) ? id : null;
    }
}