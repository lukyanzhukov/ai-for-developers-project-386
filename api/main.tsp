import "@typespec/http";
import "@typespec/openapi3";
using TypeSpec.Http;

@service(#{ title: "Call Calendar API" })
namespace CallCalendar;

model Health {
  status: "ok";
}

@route("/api/health")
@get
op getHealth(): Health;
