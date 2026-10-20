using Npgsql;

namespace InventarioApi.Data;

public class Db
{
    private readonly string _cs;

    public Db(IConfiguration cfg) =>
        _cs = cfg.GetConnectionString("Default")
              ?? throw new InvalidOperationException("Falta ConnectionStrings:Default");

    public NpgsqlConnection Create() => new(_cs);
}