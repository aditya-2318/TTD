// =====================================================
// SUPABASE CONFIGURATION
// =====================================================

// Replace these with your own Supabase values.

const SUPABASE_URL = "https://ltrydfyqapfigudpyuqb.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_vsgbQH0Zos3HLGZ7NKDPnA_GysCTtAu";


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
const logoutBtn = document.getElementById("logoutBtn");

const employeeSection = document.getElementById("employeeSection");
const ownerSection = document.getElementById("ownerSection");

const myTasksContainer = document.getElementById("myTasksContainer");

const employeeSearch = document.getElementById("employeeSearch");
const employeeList = document.getElementById("employeeList");
const selectedEmployeeName = document.getElementById("selectedEmployeeName");
const ownerTasksContainer = document.getElementById("ownerTasksContainer");

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskTitleInput = document.getElementById("taskTitle");
const taskDateInput = document.getElementById("taskDate");
const closeModalBtn = document.getElementById("closeModal");

const ownerTaskModal = document.getElementById("ownerTaskModal");
const ownerTaskForm = document.getElementById("ownerTaskForm");
const ownerTaskTitleInput = document.getElementById("ownerTaskTitle");
const ownerTaskDateInput = document.getElementById("ownerTaskDate");
const closeOwnerModalBtn = document.getElementById("closeOwnerModal");


// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (session) {
        currentUser = session.user;
        await loadUserProfile();
    } else {
        showLogin();
    }
});


// ============================================================
// AUTH STATE LISTENER
// ============================================================

supabaseClient.auth.onAuthStateChange(async (event, session) => {

    if (session) {
        currentUser = session.user;

        await loadUserProfile();
    } else {
        currentUser = null;
        currentProfile = null;

        showLogin();
    }
});


// ============================================================
// LOGIN
// ============================================================

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        loginError.textContent = "";

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            loginError.textContent = "Please enter your email and password.";
            return;
        }

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {

            console.error("Login error:", error);

            loginError.textContent =
                error.message || "Invalid email or password.";

            return;
        }

        currentUser = data.user;

        await loadUserProfile();
    });
}


// ============================================================
// LOAD USER PROFILE
// ============================================================

async function loadUserProfile() {

    if (!currentUser) {
        return;
    }

    console.log("Logged-in user ID:", currentUser.id);
    console.log("Logged-in email:", currentUser.email);

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", currentUser.id)
        .maybeSingle();

    console.log("Profile data:", data);
    console.log("Profile error:", error);

    if (error) {

        console.error("PROFILE QUERY FAILED:", error);

        alert(
            "Profile query failed:\n\n" +
            error.message
        );

        await supabaseClient.auth.signOut();

        return;
    }

    if (!data) {

        console.error(
            "No profile found for UUID:",
            currentUser.id
        );

        alert(
            "No profile was found for this account.\n\n" +
            "User ID:\n" +
            currentUser.id
        );

        await supabaseClient.auth.signOut();

        return;
    }

    currentProfile = data;

    console.log(
        "Profile loaded successfully:",
        currentProfile
    );

    userName.textContent = currentProfile.full_name;
    userRole.textContent = currentProfile.role.toUpperCase();

    loginPage.classList.add("hidden");
    appPage.classList.remove("hidden");


    // --------------------------------------------------------
    // EMPLOYEE
    // --------------------------------------------------------

    if (currentProfile.role === "employee") {

        employeeSection.classList.remove("hidden");
        ownerSection.classList.add("hidden");

        await loadMyTasks();

        return;
    }


    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    if (currentProfile.role === "owner") {

        employeeSection.classList.add("hidden");
        ownerSection.classList.remove("hidden");

        await loadEmployees();

        return;
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
// LOGOUT
// ============================================================

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        await supabaseClient.auth.signOut();

        currentUser = null;
        currentProfile = null;
        currentTasks = [];
        selectedEmployee = null;
    });
}


// ============================================================
// ============================================================
// WORKING DAY / OVERDUE LOGIC
// ============================================================
// ============================================================

/*
    WORKING DAYS:

    Monday      = Working
    Tuesday     = Working
    Wednesday   = Working
    Thursday    = Working
    Friday      = Working

    Saturday:
        1st Saturday = Non-working
        2nd Saturday = Working
        3rd Saturday = Non-working
        4th Saturday = Working
        5th Saturday = Non-working

    Sunday = Non-working
*/


// ------------------------------------------------------------
// CHECK IF DATE IS A WORKING DAY
// ------------------------------------------------------------

function isWorkingDay(date) {

    const day = date.getDay();

    // Monday - Friday
    if (day >= 1 && day <= 5) {
        return true;
    }

    // Sunday
    if (day === 0) {
        return false;
    }

    // Saturday
    if (day === 6) {

        const dateOfMonth = date.getDate();

        // 1st, 2nd, 3rd, 4th or 5th Saturday
        const saturdayNumber =
            Math.ceil(dateOfMonth / 7);

        // Only 2nd and 4th Saturday are working
        return (
            saturdayNumber === 2 ||
            saturdayNumber === 4
        );
    }

    return false;
}


// ------------------------------------------------------------
// COUNT WORKING DAYS SINCE TASK DATE
// ------------------------------------------------------------

function getWorkingDaysPending(taskDateString) {

    const taskDate =
        new Date(taskDateString + "T00:00:00");

    const today = new Date();

    taskDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(taskDate);

    let workingDays = 0;

    // Start counting from the day AFTER the task date
    currentDate.setDate(
        currentDate.getDate() + 1
    );

    while (currentDate <= today) {

        if (isWorkingDay(currentDate)) {
            workingDays++;
        }

        currentDate.setDate(
            currentDate.getDate() + 1
        );
    }

    return workingDays;
}


// ------------------------------------------------------------
// CHECK IF TASK IS OVERDUE
// ------------------------------------------------------------

function isTaskOverdue(task) {

    // Completed tasks are never overdue
    if (task.completed) {
        return false;
    }

    const workingDaysPending =
        getWorkingDaysPending(task.task_date);

    return workingDaysPending >= 3;
}


// ============================================================
// TASK STATUS HELPERS
// ============================================================

function getTaskStatus(task) {

    if (task.completed) {
        return "completed";
    }

    if (isTaskOverdue(task)) {
        return "overdue";
    }

    return "pending";
}


// ============================================================
// EMPLOYEE - LOAD MY TASKS
// ============================================================

async function loadMyTasks() {

    const { data, error } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("task_date", {
            ascending: false
        })
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error("Error loading tasks:", error);

        myTasksContainer.innerHTML = `
            <p class="error-message">
                Unable to load your tasks.
            </p>
        `;

        return;
    }

    currentTasks = data || [];

    renderTasks(
        currentTasks,
        myTasksContainer,
        true
    );
}


// ============================================================
// RENDER TASKS
// ============================================================

function renderTasks(
    tasks,
    container,
    allowCompletion
) {

    container.innerHTML = "";

    if (!tasks || tasks.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <p>No tasks found.</p>
            </div>
        `;

        return;
    }


    // --------------------------------------------------------
    // GROUP TASKS BY DATE
    // --------------------------------------------------------

    const groupedTasks = {};

    tasks.forEach(task => {

        if (!groupedTasks[task.task_date]) {
            groupedTasks[task.task_date] = [];
        }

        groupedTasks[task.task_date].push(task);
    });


    // --------------------------------------------------------
    // SORT DATES - NEWEST FIRST
    // --------------------------------------------------------

    const sortedDates =
        Object.keys(groupedTasks).sort(
            (a, b) =>
                new Date(b) - new Date(a)
        );


    sortedDates.forEach(date => {

        const dayCard =
            document.createElement("div");

        dayCard.className = "task-day-card";


        // ----------------------------------------------------
        // DATE HEADER
        // ----------------------------------------------------

        const dateHeader =
            document.createElement("div");

        dateHeader.className = "task-day-header";

        dateHeader.textContent =
            formatDate(date);

        dayCard.appendChild(dateHeader);


        // ----------------------------------------------------
        // SORT TASKS
        // ----------------------------------------------------
        // Pending + overdue first
        // Completed tasks afterwards
        // ----------------------------------------------------

        const sortedTasks =
            groupedTasks[date].sort((a, b) => {

                const aCompleted =
                    a.completed;

                const bCompleted =
                    b.completed;

                if (aCompleted && !bCompleted) {
                    return 1;
                }

                if (!aCompleted && bCompleted) {
                    return -1;
                }

                return (
                    new Date(a.created_at) -
                    new Date(b.created_at)
                );
            });


        // ----------------------------------------------------
        // RENDER EACH TASK
        // ----------------------------------------------------

        sortedTasks.forEach(task => {

            const overdue =
                isTaskOverdue(task);

            const status =
                getTaskStatus(task);


            const taskItem =
                document.createElement("div");

            taskItem.className =
                "task-item";


            // ------------------------------------------------
            // ADD STATUS CLASS
            // ------------------------------------------------

            if (task.completed) {

                taskItem.classList.add(
                    "completed"
                );

            } else if (overdue) {

                taskItem.classList.add(
                    "overdue"
                );
            }


            // ------------------------------------------------
            // TASK CONTENT
            // ------------------------------------------------

            const taskContent =
                document.createElement("div");

            taskContent.className =
                "task-content";


            // ------------------------------------------------
            // CHECKBOX
            // ------------------------------------------------

            const checkbox =
                document.createElement("input");

            checkbox.type = "checkbox";

            checkbox.checked =
                task.completed;


            // Overdue tasks cannot be completed
            if (overdue && !task.completed) {

                checkbox.disabled = true;

                checkbox.title =
                    "This task can no longer be completed because it has been pending for 3 working days.";
            }


            // Only allow completion when permitted
            if (
                allowCompletion &&
                !task.completed &&
                !overdue
            ) {

                checkbox.addEventListener(
                    "change",
                    () => {
                        toggleTask(
                            task.id,
                            checkbox.checked
                        );
                    }
                );

            } else {

                checkbox.disabled = true;
            }


            // ------------------------------------------------
            // TASK TITLE
            // ------------------------------------------------

            const title =
                document.createElement("span");

            title.className =
                "task-title";

            title.textContent =
                task.title;


            // ------------------------------------------------
            // OVERDUE LABEL
            // ------------------------------------------------

            if (overdue) {

                const overdueLabel =
                    document.createElement("span");

                overdueLabel.className =
                    "overdue-label";

                overdueLabel.textContent =
                    "OVERDUE";

                title.appendChild(
                    document.createTextNode(" ")
                );

                title.appendChild(
                    overdueLabel
                );
            }


            taskContent.appendChild(
                checkbox
            );

            taskContent.appendChild(
                title
            );


            // ------------------------------------------------
            // TASK META
            // ------------------------------------------------

            const taskMeta =
                document.createElement("div");

            taskMeta.className =
                "task-meta";


            if (overdue) {

                const workingDays =
                    getWorkingDaysPending(
                        task.task_date
                    );

                taskMeta.textContent =
                    `${workingDays} working days pending`;

            } else if (task.completed) {

                taskMeta.textContent =
                    "Completed";

            } else {

                taskMeta.textContent =
                    "Pending";
            }


            taskItem.appendChild(
                taskContent
            );

            taskItem.appendChild(
                taskMeta
            );


            dayCard.appendChild(
                taskItem
            );
        });


        container.appendChild(
            dayCard
        );
    });
}


// ============================================================
// TOGGLE TASK COMPLETION
// ============================================================

async function toggleTask(
    taskId,
    completed
) {

    // Find task from currently loaded tasks
    const task =
        currentTasks.find(
            t => t.id === taskId
        );


    if (!task) {

        console.error(
            "Task not found:",
            taskId
        );

        return;
    }


    // --------------------------------------------------------
    // IMPORTANT:
    // Prevent overdue tasks from being completed.
    // --------------------------------------------------------

    if (
        completed &&
        isTaskOverdue(task)
    ) {

        alert(
            "This task has been pending for 3 working days and can no longer be marked as complete."
        );

        return;
    }


    const { error } =
        await supabaseClient
            .from("tasks")
            .update({
                completed: completed,
                completed_at: completed
                    ? new Date().toISOString()
                    : null
            })
            .eq("id", taskId);


    if (error) {

        console.error(
            "Error updating task:",
            error
        );

        alert(
            "Unable to update task."
        );

        return;
    }


    await loadMyTasks();
}


// ============================================================
// EMPLOYEE - OPEN ADD TASK MODAL
// ============================================================

const addTaskBtn =
    document.getElementById("addTaskBtn");

if (addTaskBtn) {

    addTaskBtn.addEventListener(
        "click",
        () => {

            taskTitleInput.value = "";

            taskDateInput.value =
                getTodayDate();

            taskModal.classList.remove(
                "hidden"
            );
        }
    );
}


// ============================================================
// EMPLOYEE - CLOSE TASK MODAL
// ============================================================

if (closeModalBtn) {

    closeModalBtn.addEventListener(
        "click",
        () => {

            taskModal.classList.add(
                "hidden"
            );
        }
    );
}


// ============================================================
// EMPLOYEE - ADD TASK
// ============================================================

if (taskForm) {

    taskForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const title =
                taskTitleInput.value.trim();

            const date =
                taskDateInput.value;


            if (!title || !date) {

                alert(
                    "Please enter a task and date."
                );

                return;
            }


            const { error } =
                await supabaseClient
                    .from("tasks")
                    .insert({
                        user_id: currentUser.id,
                        title: title,
                        task_date: date,
                        completed: false,
                        created_by: currentUser.id
                    });


            if (error) {

                console.error(
                    "Error adding task:",
                    error
                );

                alert(
                    "Unable to add task."
                );

                return;
            }


            taskModal.classList.add(
                "hidden"
            );


            await loadMyTasks();
        }
    );
}


// ============================================================
// OWNER - LOAD EMPLOYEES
// ============================================================

async function loadEmployees() {

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select(
                "id, full_name, role"
            )
            .eq("role", "employee")
            .order("full_name", {
                ascending: true
            });


    if (error) {

        console.error(
            "Error loading employees:",
            error
        );

        employeeList.innerHTML = `
            <p class="error-message">
                Unable to load employees.
            </p>
        `;

        return;
    }


    ownerEmployees =
        data || [];

    renderEmployees(
        ownerEmployees
    );
}


// ============================================================
// OWNER - RENDER EMPLOYEES
// ============================================================

function renderEmployees(
    employees
) {

    employeeList.innerHTML = "";


    if (!employees.length) {

        employeeList.innerHTML = `
            <p class="empty-state">
                No employees found.
            </p>
        `;

        return;
    }


    employees.forEach(employee => {

        const employeeItem =
            document.createElement("button");

        employeeItem.className =
            "employee-item";

        employeeItem.textContent =
            employee.full_name;


        employeeItem.addEventListener(
            "click",
            async () => {

                selectedEmployee =
                    employee;

                selectedEmployeeName.textContent =
                    employee.full_name;

                await loadEmployeeTasks(
                    employee.id
                );
            }
        );


        employeeList.appendChild(
            employeeItem
        );
    });
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


            renderEmployees(
                filtered
            );
        }
    );
}


// ============================================================
// OWNER - LOAD EMPLOYEE TASKS
// ============================================================

async function loadEmployeeTasks(
    employeeId
) {

    const { data, error } =
        await supabaseClient
            .from("tasks")
            .select("*")
            .eq("user_id", employeeId)
            .order("task_date", {
                ascending: false
            })
            .order("created_at", {
                ascending: true
            });


    if (error) {

        console.error(
            "Error loading employee tasks:",
            error
        );

        ownerTasksContainer.innerHTML = `
            <p class="error-message">
                Unable to load employee tasks.
            </p>
        `;

        return;
    }


    renderTasks(
        data || [],
        ownerTasksContainer,
        false
    );
}


// ============================================================
// OWNER - OPEN ADD TASK MODAL
// ============================================================

const addOwnerTaskBtn =
    document.getElementById(
        "addOwnerTaskBtn"
    );

if (addOwnerTaskBtn) {

    addOwnerTaskBtn.addEventListener(
        "click",
        () => {

            if (!selectedEmployee) {

                alert(
                    "Please select an employee first."
                );

                return;
            }


            ownerTaskTitleInput.value = "";

            ownerTaskDateInput.value =
                getTodayDate();

            ownerTaskModal.classList.remove(
                "hidden"
            );
        }
    );
}


// ============================================================
// OWNER - CLOSE ADD TASK MODAL
// ============================================================

if (closeOwnerModalBtn) {

    closeOwnerModalBtn.addEventListener(
        "click",
        () => {

            ownerTaskModal.classList.add(
                "hidden"
            );
        }
    );
}


// ============================================================
// OWNER - ADD TASK FOR EMPLOYEE
// ============================================================

if (ownerTaskForm) {

    ownerTaskForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (!selectedEmployee) {

                alert(
                    "Please select an employee first."
                );

                return;
            }


            const title =
                ownerTaskTitleInput.value.trim();

            const date =
                ownerTaskDateInput.value;


            if (!title || !date) {

                alert(
                    "Please enter a task and date."
                );

                return;
            }


            const { error } =
                await supabaseClient
                    .from("tasks")
                    .insert({
                        user_id:
                            selectedEmployee.id,

                        title:
                            title,

                        task_date:
                            date,

                        completed:
                            false,

                        created_by:
                            currentUser.id
                    });


            if (error) {

                console.error(
                    "Error adding owner task:",
                    error
                );

                alert(
                    "Unable to add task."
                );

                return;
            }


            ownerTaskModal.classList.add(
                "hidden"
            );


            await loadEmployeeTasks(
                selectedEmployee.id
            );
        }
    );
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(
    dateString
) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-GB",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}


// ============================================================
// GET TODAY'S DATE
// ============================================================

function getTodayDate() {

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

    if (value === null ||
        value === undefined) {

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