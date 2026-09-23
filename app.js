// ============================================================
// TASKFLOW - APP.JS
// ============================================================

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL = "https://ltrydfyqapfigudpyuqb.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_vsgbQH0Zos3HLGZ7NKDPnA_GysCTtAu";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;
let currentProfile = null;

let currentTasks = [];

let selectedEmployee = null;
let ownerEmployees = [];

let profileLoading = false;


// ============================================================
// DOM ELEMENTS
// ============================================================

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("loginError");

const userName = document.getElementById("userName");
const userRole = document.getElementById("userRole");
const logoutBtn = document.getElementById("logoutButton");

const employeeSection =
    document.getElementById("employeeSection");

const ownerSection =
    document.getElementById("ownerSection");

const myTasksContainer =
    document.getElementById("employeeTasks");

const employeeSearch =
    document.getElementById("employeeSearch");

const employeeList =
    document.getElementById("employees");

const selectedEmployeeHeader =
    document.getElementById("selectedEmployeeHeader");

const ownerAddTaskButton =
    document.getElementById("ownerAddTaskButton");

const ownerTasksContainer =
    document.getElementById("ownerTasks");

const taskModal =
    document.getElementById("taskModal");

const taskForm =
    document.getElementById("taskForm");

const taskTitleInput =
    document.getElementById("taskTitle");

const taskDateInput =
    document.getElementById("taskDate");

const ownerTaskModal =
    document.getElementById("ownerTaskModal");

const ownerTaskForm =
    document.getElementById("ownerTaskForm");

const ownerTaskTitleInput =
    document.getElementById("ownerTaskTitle");

const ownerTaskDateInput =
    document.getElementById("ownerTaskDate");


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("TASKFLOW APP LOADED");

    if (taskDateInput) {
        taskDateInput.value = getTodayString();
    }

    if (ownerTaskDateInput) {
        ownerTaskDateInput.value = getTodayString();
    }

    try {

        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Session error:", error);
            showLogin();
            return;
        }

        if (session) {

            currentUser = session.user;

            await loadUserProfile();

        } else {

            showLogin();

        }

    } catch (error) {

        console.error("Initialization error:", error);

        showLogin();

    }
});


// ============================================================
// AUTH STATE LISTENER
// ============================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        console.log("Auth event:", event);

        if (event === "SIGNED_OUT") {

            currentUser = null;
            currentProfile = null;
            selectedEmployee = null;
            ownerEmployees = [];
            currentTasks = [];

            showLogin();

            return;
        }

        if (
            event === "SIGNED_IN" ||
            event === "INITIAL_SESSION"
        ) {

            if (session && session.user) {

                currentUser = session.user;

                // Small delay prevents race conditions between
                // Supabase auth and profile query.
                setTimeout(() => {

                    loadUserProfile();

                }, 100);

            }

        }
    }
);


// ============================================================
// LOGIN
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            loginError.textContent = "";

            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;

            if (!email || !password) {

                loginError.textContent =
                    "Please enter your email and password.";

                return;
            }

            const {
                data,
                error
            } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {

                console.error("Login error:", error);

                loginError.textContent =
                    error.message ||
                    "Invalid email or password.";

                return;
            }

            currentUser = data.user;

            await loadUserProfile();
        }
    );
}


// ============================================================
// LOAD USER PROFILE
// ============================================================

async function loadUserProfile() {

    if (!currentUser) {
        return;
    }

    if (profileLoading) {
        return;
    }

    profileLoading = true;

    console.log(
        "Logged-in user ID:",
        currentUser.id
    );

    console.log(
        "Logged-in email:",
        currentUser.email
    );

    try {

        const {
            data: profile,
            error
        } = await supabaseClient
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", currentUser.id)
            .maybeSingle();

        console.log(
            "Profile data:",
            profile
        );

        console.log(
            "Profile error:",
            error
        );

        if (error) {

            console.error(
                "Profile query failed:",
                error
            );

            showLogin();

            loginError.textContent =
                "Unable to load your account profile.";

            return;
        }

        if (!profile) {

            console.error(
                "No profile found for:",
                currentUser.id
            );

            showLogin();

            loginError.textContent =
                "Your account exists but no profile has been created.";

            return;
        }

        currentProfile = profile;

        console.log(
            "Profile loaded successfully:",
            profile
        );

        showApplication();

    } catch (error) {

        console.error(
            "Unexpected profile error:",
            error
        );

        showLogin();

    } finally {

        profileLoading = false;

    }
}


// ============================================================
// SHOW LOGIN
// ============================================================

function showLogin() {

    if (loginPage) {
        loginPage.classList.remove("hidden");
    }

    if (appPage) {
        appPage.classList.add("hidden");
    }

}


// ============================================================
// SHOW APPLICATION
// ============================================================

async function showApplication() {

    if (loginPage) {
        loginPage.classList.add("hidden");
    }

    if (appPage) {
        appPage.classList.remove("hidden");
    }

    if (userName) {
        userName.textContent =
            currentProfile.full_name;
    }

    if (userRole) {
        userRole.textContent =
            currentProfile.role === "owner"
                ? "Owner"
                : "Employee";
    }


    if (currentProfile.role === "owner") {

        employeeSection.classList.add("hidden");

        ownerSection.classList.remove("hidden");

        await loadEmployees();

    } else {

        ownerSection.classList.add("hidden");

        employeeSection.classList.remove("hidden");

        await loadEmployeeTasks();

    }
}


// ============================================================
// LOGOUT
// ============================================================

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            try {

                await supabaseClient.auth.signOut();

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }

        }
    );
}


// ============================================================
// TASK MODAL - EMPLOYEE
// ============================================================

function openTaskModal() {

    if (!taskModal) {
        console.error("taskModal not found.");
        return;
    }

    taskModal.classList.remove("hidden");

    if (taskDateInput) {
        taskDateInput.value =
            getTodayString();
    }

    if (taskTitleInput) {
        taskTitleInput.value = "";
        taskTitleInput.focus();
    }
}


function closeTaskModal() {

    if (!taskModal) {
        return;
    }

    taskModal.classList.add("hidden");

    if (taskForm) {
        taskForm.reset();
    }

    if (taskDateInput) {
        taskDateInput.value =
            getTodayString();
    }
}


// ============================================================
// TASK MODAL - OWNER
// ============================================================

function openOwnerTaskModal() {

    if (!selectedEmployee) {

        alert(
            "Please select an employee first."
        );

        return;
    }

    if (!ownerTaskModal) {
        console.error(
            "ownerTaskModal not found."
        );

        return;
    }

    ownerTaskModal.classList.remove("hidden");

    if (ownerTaskDateInput) {

        ownerTaskDateInput.value =
            getTodayString();

    }

    if (ownerTaskTitleInput) {

        ownerTaskTitleInput.value = "";

        ownerTaskTitleInput.focus();

    }
}


function closeOwnerTaskModal() {

    if (!ownerTaskModal) {
        return;
    }

    ownerTaskModal.classList.add("hidden");

    if (ownerTaskForm) {
        ownerTaskForm.reset();
    }

    if (ownerTaskDateInput) {

        ownerTaskDateInput.value =
            getTodayString();

    }
}


// ============================================================
// EMPLOYEE - ADD TASK
// ============================================================

if (taskForm) {

    taskForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!currentUser) {

                alert(
                    "You are not logged in."
                );

                return;
            }

            const title =
                taskTitleInput.value.trim();

            const taskDate =
                taskDateInput.value;

            if (!title || !taskDate) {

                alert(
                    "Please enter a task and date."
                );

                return;
            }

            const submitButton =
                taskForm.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent =
                    "Adding...";
            }

            try {

                const {
                    error
                } = await supabaseClient
                    .from("tasks")
                    .insert({
                        user_id: currentUser.id,
                        title: title,
                        task_date: taskDate,
                        completed: false,
                        completed_at: null,
                        created_by: currentUser.id
                    });

                if (error) {

                    console.error(
                        "Add task error:",
                        error
                    );

                    alert(
                        "Could not add task:\n" +
                        error.message
                    );

                    return;
                }

                closeTaskModal();

                await loadEmployeeTasks();

            } catch (error) {

                console.error(
                    "Unexpected add task error:",
                    error
                );

                alert(
                    "Something went wrong while adding the task."
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "Add Task";

                }

            }
        }
    );
}


// ============================================================
// EMPLOYEE - LOAD TASKS
// ============================================================

async function loadEmployeeTasks() {

    if (!currentUser) {
        return;
    }

    if (!myTasksContainer) {
        return;
    }

    myTasksContainer.innerHTML =
        "<p>Loading tasks...</p>";

    try {

        const {
            data: tasks,
            error
        } = await supabaseClient
            .from("tasks")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("task_date", {
                ascending: false
            })
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.error(
                "Load employee tasks error:",
                error
            );

            myTasksContainer.innerHTML =
                `<p class="error-message">
                    Could not load tasks: ${escapeHtml(error.message)}
                </p>`;

            return;
        }

        currentTasks = tasks || [];

        renderTasks(
            currentTasks,
            myTasksContainer
        );

    } catch (error) {

        console.error(
            "Unexpected task loading error:",
            error
        );

        myTasksContainer.innerHTML =
            `<p class="error-message">
                Could not load tasks.
            </p>`;

    }
}


// ============================================================
// EMPLOYEE - TOGGLE TASK
// ============================================================

async function toggleTask(
    taskId,
    completed
) {

    const task =
        currentTasks.find(
            item => String(item.id) === String(taskId)
        );

    if (!task) {

        console.error(
            "Task not found:",
            taskId
        );

        return;
    }

    // Overdue tasks cannot be completed.
    if (
        !task.completed &&
        isTaskOverdue(task)
    ) {

        alert(
            "This task is overdue and cannot be marked as completed."
        );

        return;
    }

    try {

        const {
            error
        } = await supabaseClient
            .from("tasks")
            .update({
                completed: completed,
                completed_at:
                    completed
                        ? new Date().toISOString()
                        : null
            })
            .eq("id", task.id)
            .eq("user_id", currentUser.id);

        if (error) {

            console.error(
                "Toggle task error:",
                error
            );

            alert(
                "Could not update task:\n" +
                error.message
            );

            return;
        }

        await loadEmployeeTasks();

    } catch (error) {

        console.error(
            "Unexpected toggle error:",
            error
        );

    }
}


// ============================================================
// OWNER - LOAD EMPLOYEES
// ============================================================

async function loadEmployees() {

    if (!employeeList) {
        return;
    }

    employeeList.innerHTML =
        "<p>Loading employees...</p>";

    try {

        const {
            data: employees,
            error
        } = await supabaseClient
            .from("profiles")
            .select("id, full_name, role")
            .eq("role", "employee")
            .order("full_name", {
                ascending: true
            });

        if (error) {

            console.error(
                "Load employees error:",
                error
            );

            employeeList.innerHTML =
                `<p class="error-message">
                    Could not load employees.
                </p>`;

            return;
        }

        ownerEmployees =
            employees || [];

        renderEmployees(
            ownerEmployees
        );

    } catch (error) {

        console.error(
            "Unexpected employee loading error:",
            error
        );

        employeeList.innerHTML =
            "<p>Could not load employees.</p>";

    }
}


// ============================================================
// OWNER - RENDER EMPLOYEES
// ============================================================

function renderEmployees(
    employees
) {

    if (!employeeList) {
        return;
    }

    if (!employees.length) {

        employeeList.innerHTML =
            "<p>No employees found.</p>";

        return;
    }

    employeeList.innerHTML =
        employees
            .map(employee => {

                const selected =
                    selectedEmployee &&
                    selectedEmployee.id === employee.id;

                return `
                    <button
                        type="button"
                        class="employee-item ${selected ? "active" : ""}"
                        onclick="selectEmployee('${employee.id}')"
                    >
                        ${escapeHtml(employee.full_name)}
                    </button>
                `;

            })
            .join("");
}


// ============================================================
// OWNER - SEARCH EMPLOYEES
// ============================================================

if (employeeSearch) {

    employeeSearch.addEventListener(
        "input",
        () => {

            const search =
                employeeSearch.value
                    .trim()
                    .toLowerCase();

            const filtered =
                ownerEmployees.filter(
                    employee =>
                        employee.full_name
                            .toLowerCase()
                            .includes(search)
                );

            renderEmployees(filtered);

        }
    );
}


// ============================================================
// OWNER - SELECT EMPLOYEE
// ============================================================

async function selectEmployee(
    employeeId
) {

    const employee =
        ownerEmployees.find(
            item => item.id === employeeId
        );

    if (!employee) {
        return;
    }

    selectedEmployee = employee;

    renderEmployees(
        getFilteredEmployees()
    );

    if (selectedEmployeeHeader) {

        selectedEmployeeHeader.innerHTML = `
            <h2>
                ${escapeHtml(employee.full_name)}
            </h2>
            <p>
                View and manage this employee's tasks.
            </p>
        `;

    }

    if (ownerAddTaskButton) {
        ownerAddTaskButton.classList.remove("hidden");
    }

    await loadOwnerTasks(
        employee.id
    );
}


// ============================================================
// OWNER - FILTERED EMPLOYEES
// ============================================================

function getFilteredEmployees() {

    if (!employeeSearch) {
        return ownerEmployees;
    }

    const search =
        employeeSearch.value
            .trim()
            .toLowerCase();

    if (!search) {
        return ownerEmployees;
    }

    return ownerEmployees.filter(
        employee =>
            employee.full_name
                .toLowerCase()
                .includes(search)
    );
}


// ============================================================
// OWNER - LOAD TASKS
// ============================================================

async function loadOwnerTasks(
    employeeId
) {

    if (!ownerTasksContainer) {
        return;
    }

    ownerTasksContainer.innerHTML =
        "<p>Loading tasks...</p>";

    try {

        const {
            data: tasks,
            error
        } = await supabaseClient
            .from("tasks")
            .select("*")
            .eq("user_id", employeeId)
            .order("task_date", {
                ascending: false
            })
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.error(
                "Load owner tasks error:",
                error
            );

            ownerTasksContainer.innerHTML =
                `<p class="error-message">
                    Could not load tasks:
                    ${escapeHtml(error.message)}
                </p>`;

            return;
        }

        renderTasks(
            tasks || [],
            ownerTasksContainer,
            true
        );

    } catch (error) {

        console.error(
            "Unexpected owner task error:",
            error
        );

        ownerTasksContainer.innerHTML =
            "<p>Could not load tasks.</p>";

    }
}


// ============================================================
// OWNER - ADD TASK
// ============================================================

if (ownerTaskForm) {

    ownerTaskForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!currentUser) {

                alert(
                    "You are not logged in."
                );

                return;
            }

            if (!selectedEmployee) {

                alert(
                    "Please select an employee first."
                );

                return;
            }

            const title =
                ownerTaskTitleInput.value.trim();

            const taskDate =
                ownerTaskDateInput.value;

            if (!title || !taskDate) {

                alert(
                    "Please enter a task and date."
                );

                return;
            }

            const submitButton =
                ownerTaskForm.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Adding...";

            }

            try {

                const {
                    error
                } = await supabaseClient
                    .from("tasks")
                    .insert({
                        user_id:
                            selectedEmployee.id,

                        title:
                            title,

                        task_date:
                            taskDate,

                        completed:
                            false,

                        completed_at:
                            null,

                        created_by:
                            currentUser.id
                    });

                if (error) {

                    console.error(
                        "Owner add task error:",
                        error
                    );

                    alert(
                        "Could not add task:\n" +
                        error.message
                    );

                    return;
                }

                closeOwnerTaskModal();

                await loadOwnerTasks(
                    selectedEmployee.id
                );

            } catch (error) {

                console.error(
                    "Unexpected owner add task error:",
                    error
                );

                alert(
                    "Something went wrong while adding the task."
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "Add Task";

                }

            }

        }
    );
}


// ============================================================
// RENDER TASKS
// ============================================================

function renderTasks(
    tasks,
    container,
    ownerView = false
) {

    if (!container) {
        return;
    }

    if (!tasks || !tasks.length) {

        container.innerHTML =
            `
            <div class="empty-state">
                <p>No tasks found.</p>
            </div>
            `;

        return;
    }

    // Separate pending and completed tasks.
    const pendingTasks =
        tasks.filter(
            task => !task.completed
        );

    const completedTasks =
        tasks.filter(
            task => task.completed
        );

    // Sort pending tasks:
    // newest date first.
    pendingTasks.sort(
        (a, b) =>
            new Date(b.task_date) -
            new Date(a.task_date)
    );

    // Completed tasks remain below pending.
    completedTasks.sort(
        (a, b) =>
            new Date(b.task_date) -
            new Date(a.task_date)
    );

    const orderedTasks = [
        ...pendingTasks,
        ...completedTasks
    ];

    container.innerHTML =
        orderedTasks
            .map(task =>
                createTaskHTML(
                    task,
                    ownerView
                )
            )
            .join("");
}


// ============================================================
// CREATE TASK HTML
// ============================================================

function createTaskHTML(
    task,
    ownerView = false
) {

    const overdue =
        !task.completed &&
        isTaskOverdue(task);

    const completedClass =
        task.completed
            ? "completed"
            : "";

    const overdueClass =
        overdue
            ? "overdue"
            : "";

    const workingDays =
        !task.completed
            ? getWorkingDaysPending(
                task.task_date
            )
            : 0;

    let statusHTML = "";

    if (overdue) {

        statusHTML = `
            <span class="overdue-label">
                OVERDUE
            </span>
        `;

    }

    const checkboxDisabled =
        overdue
            ? "disabled"
            : "";

    const checked =
        task.completed
            ? "checked"
            : "";

    return `
        <div
            class="task-item ${completedClass} ${overdueClass}"
            data-task-id="${task.id}"
        >

            <div class="task-checkbox-wrapper">

                <input
                    type="checkbox"
                    class="task-checkbox"
                    ${checked}
                    ${checkboxDisabled}
                    onchange="toggleTaskFromUI(
                        '${task.id}',
                        this.checked,
                        ${ownerView}
                    )"
                >

            </div>

            <div class="task-content">

                <div class="task-title">
                    ${escapeHtml(task.title)}
                    ${statusHTML}
                </div>

                <div class="task-date">
                    ${formatDate(task.task_date)}

                    ${
                        overdue
                            ? `
                                <span class="overdue-days">
                                    (${workingDays}
                                    working days pending)
                                </span>
                            `
                            : ""
                    }
                </div>

            </div>

        </div>
    `;
}


// ============================================================
// TASK UI HANDLER
// ============================================================

async function toggleTaskFromUI(
    taskId,
    completed,
    ownerView
) {

    if (ownerView) {

        await ownerToggleTask(
            taskId,
            completed
        );

    } else {

        await toggleTask(
            taskId,
            completed
        );

    }
}


// ============================================================
// OWNER - TOGGLE TASK
// ============================================================

async function ownerToggleTask(
    taskId,
    completed
) {

    const taskElement =
        document.querySelector(
            `[data-task-id="${taskId}"]`
        );

    try {

        const {
            data: task,
            error: fetchError
        } = await supabaseClient
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .maybeSingle();

        if (fetchError) {

            console.error(
                "Owner task fetch error:",
                fetchError
            );

            return;
        }

        if (!task) {
            return;
        }

        // Overdue tasks cannot be completed.
        if (
            !task.completed &&
            isTaskOverdue(task)
        ) {

            alert(
                "This task is overdue and cannot be marked as completed."
            );

            if (taskElement) {

                const checkbox =
                    taskElement.querySelector(
                        ".task-checkbox"
                    );

                if (checkbox) {
                    checkbox.checked = false;
                }

            }

            return;
        }

        const {
            error
        } = await supabaseClient
            .from("tasks")
            .update({
                completed:
                    completed,

                completed_at:
                    completed
                        ? new Date().toISOString()
                        : null
            })
            .eq("id", taskId);

        if (error) {

            console.error(
                "Owner toggle task error:",
                error
            );

            alert(
                "Could not update task:\n" +
                error.message
            );

            return;
        }

        if (selectedEmployee) {

            await loadOwnerTasks(
                selectedEmployee.id
            );

        }

    } catch (error) {

        console.error(
            "Unexpected owner toggle error:",
            error
        );

    }
}


// ============================================================
// WORKING DAY LOGIC
// ============================================================
//
// Working days:
// Monday-Friday = working
// 2nd Saturday = working
// 4th Saturday = working
// Sunday = non-working
// 1st Saturday = non-working
// 3rd Saturday = non-working
// 5th Saturday = non-working
//
// A task becomes overdue after 3 working days
// have elapsed AFTER the task date.
// ============================================================

function isWorkingDay(date) {

    const day =
        date.getDay();

    // Monday-Friday
    if (
        day >= 1 &&
        day <= 5
    ) {

        return true;
    }

    // Sunday
    if (day === 0) {

        return false;
    }

    // Saturday
    if (day === 6) {

        const saturdayNumber =
            Math.ceil(
                date.getDate() / 7
            );

        return (
            saturdayNumber === 2 ||
            saturdayNumber === 4
        );
    }

    return false;
}


// ============================================================
// COUNT WORKING DAYS PENDING
// ============================================================

function getWorkingDaysPending(
    taskDateString
) {

    if (!taskDateString) {
        return 0;
    }

    const taskDate =
        new Date(
            taskDateString +
            "T00:00:00"
        );

    const today =
        new Date();

    taskDate.setHours(
        0,
        0,
        0,
        0
    );

    today.setHours(
        0,
        0,
        0,
        0
    );

    // Future task
    if (taskDate > today) {
        return 0;
    }

    let currentDate =
        new Date(taskDate);

    let workingDays = 0;

    // Do NOT count task date itself.
    currentDate.setDate(
        currentDate.getDate() + 1
    );

    while (
        currentDate <= today
    ) {

        if (
            isWorkingDay(
                currentDate
            )
        ) {

            workingDays++;

        }

        currentDate.setDate(
            currentDate.getDate() + 1
        );
    }

    return workingDays;
}


// ============================================================
// CHECK OVERDUE
// ============================================================

function isTaskOverdue(task) {

    if (!task) {
        return false;
    }

    if (task.completed) {
        return false;
    }

    const workingDays =
        getWorkingDaysPending(
            task.task_date
        );

    return workingDays >= 3;
}


// ============================================================
// DATE FORMATTING
// ============================================================

function formatDate(
    dateString
) {

    if (!dateString) {
        return "";
    }

    const date =
        new Date(
            dateString +
            "T00:00:00"
        );

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


// ============================================================
// GET TODAY
// ============================================================

function getTodayString() {

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// CLOSE MODALS WHEN CLICKING OUTSIDE
// ============================================================

if (taskModal) {

    taskModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === taskModal
            ) {

                closeTaskModal();

            }

        }
    );

}


if (ownerTaskModal) {

    ownerTaskModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === ownerTaskModal
            ) {

                closeOwnerTaskModal();

            }

        }
    );

}


// ============================================================
// ESC KEY CLOSES MODALS
// ============================================================

document.addEventListener(
    "keydown",
    (event) => {

        if (event.key !== "Escape") {
            return;
        }

        closeTaskModal();
        closeOwnerTaskModal();

    }
);


// ============================================================
// DEBUG HELPERS
// ============================================================

console.log(
    "TaskFlow JavaScript initialized successfully."
);