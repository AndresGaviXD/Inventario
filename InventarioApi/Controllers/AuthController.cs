using InventarioApi.Data;
using InventarioApi.Models;
using InventarioApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace InventarioApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly InventarioRepository _repo;
    private readonly TokenService _tokens;

    public AuthController(InventarioRepository repo, TokenService tokens)
    {
        _repo = repo;
        _tokens = tokens;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var username = req.Username.Trim();
        var u = await _repo.BuscarUsuarioAsync(username);

        if (u is null || !u.Activo || !BCrypt.Net.BCrypt.Verify(req.Password, u.PasswordHash))
            return Unauthorized(new { error = "Usuario o contraseña incorrectos" });

        var (token, expires) = _tokens.Crear(u.Id, username, u.Rol);
        return Ok(new AuthResponse { Token = token, Username = username, Rol = u.Rol, ExpiresAt = expires });
    }
}