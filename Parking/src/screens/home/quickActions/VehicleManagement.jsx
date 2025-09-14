import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

const VehicleManagement = ({ isOpen, onClose }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    vehicle_type: "car",
    vehicle_model: "",
    vehicle_plate_number: "",
    user_id: "",
  });

  const [users, setUsers] = useState([]);

  const vehicleTypes = [
    { value: "car", label: "Car" },
    { value: "truck", label: "Truck" },
    { value: "van", label: "Van" },
    { value: "pickup", label: "Pickup" },
    { value: "bike", label: "Bike" },
    { value: "motorcycle", label: "Motorcycle" },
    { value: "scooter", label: "Scooter" },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchVehicles();
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      // Try to fetch from profiles (plural) first; fallback to profile (singular)
      let data = [];
      try {
        const { data: rows, error } = await supabase
          .from("profiles")
          .select("id, name, email")
          .order("name");
        if (!error && rows) data = rows;
      } catch (e) {
        // ignore - likely 404 when table doesn't exist
      }

      if (!data || data.length === 0) {
        try {
          const { data: rows2, error: error2 } = await supabase
            .from("profile")
            .select("id, name, email")
            .order("name");
          if (!error2 && rows2) data = rows2;
        } catch {}
      }

      if (!data || data.length === 0) {
        // Fallback to current user only (so admin can at least assign self)
        const authResult = await supabase.auth.getUser();
        if (authResult.data?.user) {
          data = [
            {
              id: authResult.data.user.id,
              name: authResult.data.user.user_metadata?.name || "Current User",
              email: authResult.data.user.email,
            },
          ];
        }
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching users:", err);
      // Set a fallback user list or leave empty
      setUsers([]);
    }
  };

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      // First try to fetch vehicles with profiles join
      let { data, error } = await supabase
        .from("vehicles")
        .select(
          `
          *,
          profiles:user_id (
            id,
            name,
            email
          )
        `,
        )
        .order("created_at", { ascending: false });

      // If join fails for any reason, try singular join alias; then without profiles and attach
      if (error) {
        console.warn("Profiles join failed, fetching vehicles without user info:", error.message);
        // Try singular form join
        try {
          const singular = await supabase
            .from("vehicles")
            .select(
              `
              *,
              profile:user_id (
                id,
                name,
                email
              )
            `,
            )
            .order("created_at", { ascending: false });
          if (!singular.error && singular.data) {
            setVehicles(singular.data);
            return;
          }
        } catch {}

        const fallbackResult = await supabase
          .from("vehicles")
          .select("*")
          .order("created_at", { ascending: false });

        if (fallbackResult.error) throw fallbackResult.error;
        data = fallbackResult.data || [];

        // Manually fetch user info for each vehicle via profiles table when available
        if (data.length > 0) {
          const userIds = [...new Set(data.map((v) => v.user_id))];
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds);

          if (!profilesError && profiles) {
            // Attach profile data to vehicles
            data = data.map((vehicle) => ({
              ...vehicle,
              profiles: profiles.find((p) => p.id === vehicle.user_id) || null,
            }));
          }

          // If still missing, try singular 'profile' table
          if (data.some((v) => !v.profiles)) {
            const missing = data.filter((v) => !v.profiles).map((v) => v.user_id);
            const { data: profiles2 } = await supabase
              .from("profile")
              .select("id, name, email")
              .in("id", missing);
            if (profiles2) {
              data = data.map((vehicle) => ({
                ...vehicle,
                profiles:
                  vehicle.profiles ||
                  profiles2.find((p) => p.id === vehicle.user_id) ||
                  null,
              }));
            }
          }
        }
      }

      // Enrich owners for any vehicles still missing owner info
      if (data && data.length > 0) {
        // 1) Batch fetch from profiles (plural)
        let missingIds = [
          ...new Set(
            data
              .filter((v) => !(v.profiles || v.profile) && v.user_id)
              .map((v) => v.user_id),
          ),
        ];
        if (missingIds.length > 0) {
          try {
            const { data: profRows } = await supabase
              .from("profiles")
              .select("id, name, email")
              .in("id", missingIds);
            if (profRows && profRows.length) {
              const map = new Map(profRows.map((p) => [p.id, p]));
              data = data.map((v) =>
                v.profiles || v.profile || !map.get(v.user_id)
                  ? v
                  : { ...v, profiles: map.get(v.user_id) },
              );
            }
          } catch {}
        }

        // Update missing after profiles attempt
        missingIds = [
          ...new Set(
            data
              .filter((v) => !(v.profiles || v.profile) && v.user_id)
              .map((v) => v.user_id),
          ),
        ];

        // 2) Batch fetch from profile (singular) if still missing
        if (missingIds.length > 0) {
          try {
            const { data: profRows2 } = await supabase
              .from("profile")
              .select("id, name, email")
              .in("id", missingIds);
            if (profRows2 && profRows2.length) {
              const map2 = new Map(profRows2.map((p) => [p.id, p]));
              data = data.map((v) =>
                v.profiles || v.profile || !map2.get(v.user_id)
                  ? v
                  : { ...v, profiles: map2.get(v.user_id) },
              );
            }
          } catch {}
        }

        // 3) Final fallback: SECURITY DEFINER RPC per user
        missingIds = [
          ...new Set(
            data
              .filter((v) => !(v.profiles || v.profile) && v.user_id)
              .map((v) => v.user_id),
          ),
        ];
        if (missingIds.length > 0) {
          const entries = await Promise.all(
            missingIds.map(async (uid) => {
              try {
                const { data: prof, error: rpcErr } = await supabase.rpc(
                  "get_profile_for_admin",
                  { user_id: uid },
                );
                if (!rpcErr && Array.isArray(prof) && prof.length > 0) {
                  const p = prof[0];
                  return [uid, { id: p.id, name: p.name, email: undefined }];
                }
              } catch {}
              return [uid, null];
            }),
          );
          const rpcMap = new Map(entries);
          data = data.map((v) =>
            v.profiles || v.profile || !rpcMap.get(v.user_id)
              ? v
              : { ...v, profiles: rpcMap.get(v.user_id) },
          );
        }
      }

      setVehicles(data || []);
    } catch (err) {
      console.error("Error fetching vehicles:", err);
      setError(`Failed to load vehicles: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Get current admin for activity logging
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();
      const adminId = authError ? null : authData?.user?.id || null;

      if (editingVehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from("vehicles")
          .update({
            vehicle_type: formData.vehicle_type,
            vehicle_model: formData.vehicle_model,
            vehicle_plate_number: formData.vehicle_plate_number.toUpperCase(),
            user_id: formData.user_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingVehicle.id);

        if (error) throw error;
        setSuccess("Vehicle updated successfully!");

        // Log admin activity
        try {
          await supabase.from("admin_activities").insert([
            {
              admin_id: adminId,
              action: "vehicle_update",
              details: `Updated vehicle ${formData.vehicle_plate_number.toUpperCase()} (${formData.vehicle_model})`,
            },
          ]);
        } catch (logErr) {
          console.warn("Failed to log admin activity (update)", logErr);
        }
      } else {
        // Add new vehicle
        const { error } = await supabase.from("vehicles").insert([
          {
            vehicle_type: formData.vehicle_type,
            vehicle_model: formData.vehicle_model,
            vehicle_plate_number: formData.vehicle_plate_number.toUpperCase(),
            user_id: formData.user_id,
          },
        ]);

        if (error) throw error;
        setSuccess("Vehicle added successfully!");

        // Log admin activity
        try {
          await supabase.from("admin_activities").insert([
            {
              admin_id: adminId,
              action: "vehicle_create",
              details: `Created vehicle ${formData.vehicle_plate_number.toUpperCase()} (${formData.vehicle_model})`,
            },
          ]);
        } catch (logErr) {
          console.warn("Failed to log admin activity (create)", logErr);
        }
      }

      // Reset form and refresh data
      resetForm();
      await fetchVehicles();
    } catch (err) {
      console.error("Error saving vehicle:", err);
      if (err.code === "23505") {
        setError("This plate number is already registered");
      } else {
        setError(err.message || "Failed to save vehicle");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicle_type: vehicle.vehicle_type,
      vehicle_model: vehicle.vehicle_model,
      vehicle_plate_number: vehicle.vehicle_plate_number,
      user_id: vehicle.user_id,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (vehicleId) => {
    if (
      !confirm(
        "Are you sure you want to delete this vehicle? This action cannot be undone.",
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      // Fetch the vehicle to include info in logs
      let vehicleInfo = null;
      try {
        const { data: v } = await supabase
          .from("vehicles")
          .select("vehicle_plate_number, vehicle_model")
          .eq("id", vehicleId)
          .single();
        vehicleInfo = v || null;
      } catch {}

      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicleId);

      if (error) throw error;
      setSuccess("Vehicle deleted successfully!");

      // Log admin activity
      try {
        const { data: authData } = await supabase.auth.getUser();
        const adminId = authData?.user?.id || null;
        await supabase.from("admin_activities").insert([
          {
            admin_id: adminId,
            action: "vehicle_delete",
            details: `Deleted vehicle ${vehicleInfo?.vehicle_plate_number || vehicleId} (${vehicleInfo?.vehicle_model || "unknown model"})`,
          },
        ]);
      } catch (logErr) {
        console.warn("Failed to log admin activity (delete)", logErr);
      }
      await fetchVehicles();
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      setError("Failed to delete vehicle");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicle_type: "car",
      vehicle_model: "",
      vehicle_plate_number: "",
      user_id: "",
    });
    setEditingVehicle(null);
    setShowAddForm(false);
    setError("");
    setSuccess("");
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.vehicle_model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.vehicle_plate_number
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      vehicle.profiles?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      vehicle.profiles?.email
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (vehicle.user_id || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" || vehicle.vehicle_type === filterType;

    return matchesSearch && matchesType;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Vehicle Management
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Add Vehicle Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg mb-6 flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add New Vehicle
            </button>
          )}

          {/* Add/Edit Vehicle Form */}
          {showAddForm && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vehicle Type
                  </label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicle_type: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    {vehicleTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_model}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vehicle_model: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Toyota Camry, Honda Civic"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_plate_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vehicle_plate_number: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="ABC-123"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Owner
                  </label>
                  {users && users.length > 0 ? (
                    <select
                      value={formData.user_id}
                      onChange={(e) =>
                        setFormData({ ...formData, user_id: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                    >
                      <option value="">Select Owner</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email} ({user.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.user_id}
                      onChange={(e) =>
                        setFormData({ ...formData, user_id: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Enter owner user_id (UUID)"
                      required
                    />
                  )}
                  {(!users || users.length === 0) && (
                    <p className="text-xs text-gray-400 mt-1">
                      No user list available. Paste the owner's user ID (UUID) here.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading
                      ? "Saving..."
                      : editingVehicle
                        ? "Update Vehicle"
                        : "Add Vehicle"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by model, plate number, or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types</option>
                {vehicleTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vehicles Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300">
                <thead className="bg-gray-700 text-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Model</th>
                    <th className="px-4 py-3 text-left">Plate Number</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        Loading vehicles...
                      </td>
                    </tr>
                  ) : filteredVehicles.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        {searchTerm || filterType !== "all"
                          ? "No vehicles found matching your criteria"
                          : "No vehicles registered yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <span className="capitalize">
                            {vehicle.vehicle_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{vehicle.vehicle_model}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono bg-gray-600 px-2 py-1 rounded text-xs">
                            {vehicle.vehicle_plate_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium">
                              {vehicle.profiles?.name ||
                                vehicle.profile?.name ||
                                (vehicle.user_id
                                  ? `${vehicle.user_id.substring(0, 8)}…`
                                  : "N/A")}
                            </div>
                            <div className="text-xs text-gray-400">
                              {vehicle.profiles?.email ||
                                vehicle.profile?.email ||
                                vehicle.user_id}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {new Date(vehicle.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => handleEdit(vehicle)}
                              className="text-blue-400 hover:text-blue-300"
                              title="Edit Vehicle"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(vehicle.id)}
                              className="text-red-400 hover:text-red-300"
                              title="Delete Vehicle"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vehicle Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {vehicles.length}
              </div>
              <div className="text-sm text-gray-400">Total Vehicles</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {new Set(vehicles.map((v) => v.user_id)).size}
              </div>
              <div className="text-sm text-gray-400">Vehicle Owners</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {new Set(vehicles.map((v) => v.vehicle_type)).size}
              </div>
              <div className="text-sm text-gray-400">Vehicle Types</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleManagement;
