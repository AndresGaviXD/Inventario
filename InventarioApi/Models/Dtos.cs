using System.ComponentModel.DataAnnotations;

namespace InventarioApi.Models;

public class LoginRequest
{
    [Required, MinLength(3), MaxLength(50)]
    public string Username { get; set; } = "";

    [Required, MinLength(6), MaxLength(100)]
    public string Password { get; set; } = "";
}

public class AuthResponse
{
    public string Token { get; set; } = "";
    public string Username { get; set; } = "";
    public string Rol { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public class MovimientoRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Seleccione un producto")]
    public int ProductoId { get; set; }

    [Range(1, 1000000, ErrorMessage = "La cantidad debe ser mayor a cero")]
    public int Cantidad { get; set; }

    [MaxLength(500)]
    public string? Observacion { get; set; }
}

public class ProductoRequest
{
    [Required, MaxLength(30)]
    public string Codigo { get; set; } = "";

    [Required, MaxLength(150)]
    public string Nombre { get; set; } = "";

    public string? Descripcion { get; set; }

    [Range(0, 1000000)]
    public int StockMinimo { get; set; }
}

public class Producto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string? Descripcion { get; set; }
    public int StockMinimo { get; set; }
    public bool Activo { get; set; }
}

public class InventarioItem
{
    public int ProductoId { get; set; }
    public string Codigo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int StockMinimo { get; set; }
    public long Entradas { get; set; }
    public long Salidas { get; set; }
    public long StockActual { get; set; }
    public bool BajoStock { get; set; }
}

public class MovimientoItem
{
    public long Id { get; set; }
    public string Producto { get; set; } = "";
    public string Tipo { get; set; } = "";
    public int Cantidad { get; set; }
    public string? Observacion { get; set; }
    public string? Usuario { get; set; }
    public DateTime Fecha { get; set; }
}

public class UsuarioRow
{
    public int Id { get; set; }
    public string PasswordHash { get; set; } = "";
    public string Rol { get; set; } = "operador";
    public bool Activo { get; set; }
}

public class UsuarioRequest
{
    [Required, MinLength(3), MaxLength(50)]
    public string Username { get; set; } = "";

    [Required, MinLength(6), MaxLength(100)]
    public string Password { get; set; } = "";

    [Required, RegularExpression("^(admin|operador)$", ErrorMessage = "Rol inválido")]
    public string Rol { get; set; } = "operador";
}

public class RolRequest
{
    [Required, RegularExpression("^(admin|operador)$", ErrorMessage = "Rol inválido")]
    public string Rol { get; set; } = "";
}

public class EstadoRequest
{
    public bool Activo { get; set; }
}

public class UsuarioItem
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string Rol { get; set; } = "";
    public bool Activo { get; set; }
    public DateTime CreatedAt { get; set; }
}