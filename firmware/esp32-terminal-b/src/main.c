#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "terminal-b";

void app_main(void)
{
    int count = 0;
    while (1) {
        ESP_LOGI(TAG, "telemetry -> device=term-b state=RUNNING output=%d temp=%.1f fault=%d",
                 80 + (count % 15), 27.0f + (count % 7) * 0.2f, (count % 23 == 0) ? 202 : 0);
        count++;
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}
